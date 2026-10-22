// A snapshot family must not drift by platform.
//
// `test:e2e:visual` on this Mac fails on `landing hero matches snapshot`:
//
//   Expected an image 1280px by 3460px, received 1280px by 3476px
//
// The received size is exactly the committed **linux** baseline, so the page renders
// what the runner records and the **darwin** file is the stale one. How it got stale
// is on the record in the two commits that own the files:
//
//   cd532b4 (2026-10-09) re-captured darwin at 3460, after a homepage change moved
//     it from 3482;
//   29ecbd0 (2026-10-19) re-captured the landing baseline *with the build*, because
//     that is what the gate renders — it reports going from "6187 differing pixels"
//     to 0 against the gate's own render — and it touched only the ubuntu pair,
//     because `visual-baselines.yml` runs on ubuntu.
//
// The CI job's comment asserts the reassuring half of the invariant ("both are
// committed and `gh workflow run visual-baselines` refreshes the ubuntu pair") and
// nothing checks the other half, that the two are current with each other. Consequence:
// every local visual run on macOS is red for a reason unrelated to the change under
// test, which is precisely the condition under which a baseline gets re-captured with
// `-u` until it tolerates a real defect.
//
//   VB1  every committed platform file of a family must agree on pixel dimensions;
//   VB2  dimensions come from the PNG header (signature + `IHDR`, UInt32BE at 16/20),
//        and a file that is not a readable PNG is itself a finding — a parser that
//        returned `0x0` for every file would otherwise report perfect agreement;
//   VB3  the corpus is non-empty and contains at least one family with two platforms,
//        so VB1 is comparing something, plus fixtures for agree / disagree / not-a-PNG.
//
// Dimensions, not bytes: a re-encode or a per-platform font hint changes pixels
// without meaning anything, and an md5 comparison would flag both. A size change is
// the signal that layout moved, which is what a stale baseline actually means.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { walkRepo } from "./repo-tree";

interface Dims {
  w: number;
  h: number;
}

/**
 * Pixels from the PNG header, or null when the bytes are not a PNG.
 *
 * Layout: 8-byte signature, then a 4-byte length, `IHDR`, and width/height as big
 * endian UInt32 at offsets 16 and 20.
 */
export function pngDims(bytes: Buffer): Dims | null {
  const signature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (bytes.length < 24) return null;
  for (let i = 0; i < signature.length; i++) if (bytes[i] !== signature[i]) return null;
  if (bytes.subarray(12, 16).toString("latin1") !== "IHDR") return null;
  return { w: bytes.readUInt32BE(16), h: bytes.readUInt32BE(20) };
}

/** A synthetic header for fixtures: enough of a PNG for the reader, no pixels needed. */
function fakePng(w: number, h: number): Buffer {
  const b = Buffer.alloc(24);
  [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].forEach((v, i) => b.writeUInt8(v, i));
  b.writeUInt32BE(13, 8);
  b.write("IHDR", 12, "latin1");
  b.writeUInt32BE(w, 16);
  b.writeUInt32BE(h, 20);
  return b;
}

/** `<name>` and `<project>-<platform>` for one committed snapshot file. */
export function parseSnapshotName(rel: string): { family: string; key: string; platform: string } | null {
  const m = /^(.*?-snapshots)\/(.*)-chrome-([a-z0-9]+x[a-z0-9]+)-([a-z]+)\.png$/.exec(rel);
  if (!m) return null;
  return { family: m[1], key: `${m[2]}@${m[3]}`, platform: m[4] };
}

export interface SnapshotReport {
  /** `family/key` → platform → dimensions, or null when the file is not a PNG. */
  groups: Map<string, Map<string, Dims | null>>;
  unreadable: string[];
  unparsed: string[];
}

export function snapshots(): SnapshotReport {
  const groups = new Map<string, Map<string, Dims | null>>();
  const unreadable: string[] = [];
  const unparsed: string[] = [];
  for (const rel of walkRepo("tests", (p) => p.endsWith(".png") && p.includes("-snapshots/"))) {
    const parsed = parseSnapshotName(rel);
    if (!parsed) {
      unparsed.push(rel);
      continue;
    }
    const dims = pngDims(readFileSync(new URL(`../../${rel}`, import.meta.url)));
    if (!dims) unreadable.push(rel);
    const key = `${parsed.family}/${parsed.key}`;
    if (!groups.has(key)) groups.set(key, new Map());
    groups.get(key)!.set(parsed.platform, dims);
  }
  return { groups, unreadable, unparsed };
}

/** Families whose committed platforms do not record the same dimensions. */
export function dimensionDrift(groups: Map<string, Map<string, Dims | null>>): string[] {
  const out: string[] = [];
  for (const [key, plats] of groups) {
    const sizes = new Set([...plats.values()].map((d) => (d ? `${d.w}x${d.h}` : "unreadable")));
    if (sizes.size > 1) out.push(`${key}: ${[...plats].map(([pf, d]) => `${pf}=${d ? `${d.w}x${d.h}` : "unreadable"}`).join("  ")}`);
  }
  return out;
}

describe("a visual baseline family agrees across platforms", () => {
  const report = snapshots();

  it("VB3: the corpus is the committed snapshots, and comparison is possible", () => {
    expect(report.groups.size, "no snapshot families found — this gate is guarding nothing").toBeGreaterThanOrEqual(2);
    const comparable = [...report.groups].filter(([, plats]) => plats.size >= 2);
    expect(comparable.length, "no family has two platforms committed, so VB1 compares nothing").toBeGreaterThanOrEqual(1);
    expect(report.unparsed, "a committed PNG does not match the <name>-chrome-<project>-<platform>.png scheme").toEqual([]);
    expect(report.unreadable, "a committed snapshot is not a readable PNG").toEqual([]);
  });

  it("VB1: every family's platforms record the same dimensions", () => {
    expect(
      dimensionDrift(report.groups),
      "one platform was re-captured and the other was not — a local visual run is now red for an unrelated reason",
    ).toEqual([]);
  });

  it("VB2: the reader is the thing being trusted", () => {
    // The committed landing darwin file is 3460 tall and the linux one 3476; if the
    // header offsets were wrong, both would read as the same number and VB1 would be
    // silently vacuous. These are the real bytes, not a fixture.
    const dar = readFileSync(new URL("../../tests/a11y-visual.spec.ts-snapshots/landing-main-chrome-1280x720-darwin.png", import.meta.url));
    const lin = readFileSync(new URL("../../tests/a11y-visual.spec.ts-snapshots/landing-main-chrome-1280x720-linux.png", import.meta.url));
    const d = pngDims(dar);
    const l = pngDims(lin);
    expect(d, "the darwin snapshot does not parse").not.toBeNull();
    expect(l, "the linux snapshot does not parse").not.toBeNull();
    // What must be true whether or not the pair currently agrees: the reader reports
    // the width the file's own name claims, and a full-page element snapshot is taller
    // than the viewport. Both fail if the header offsets were wrong or the reader were
    // stubbed — pinning "these two numbers differ" instead would have asserted the
    // drift itself and gone green again the moment it was fixed.
    expect(d!.w, "the darwin file's name claims 1280x720; the header must agree").toBe(1280);
    expect(l!.w, "the linux file's name claims 1280x720; the header must agree").toBe(1280);
    expect(d!.h, "a whole-page snapshot cannot be viewport-height; the height offset is misread").toBeGreaterThan(720);
    expect(l!.h).toBeGreaterThan(720);
  });
});

describe("the rules can fail", () => {
  it("VB1's shape catches a one-sided re-capture and passes a matched pair", () => {
    const mk = (entries: [string, Dims | null][]): Map<string, Map<string, Dims | null>> =>
      new Map([["spec.ts-snapshots/hero@1280x720", new Map(entries)]]);
    const drifted = dimensionDrift(mk([["darwin", { w: 1280, h: 3460 }], ["linux", { w: 1280, h: 3476 }]]));
    expect(drifted, "a one-sided re-capture was not detected").toHaveLength(1);
    expect(drifted[0]).toContain("hero@1280x720");
    expect(dimensionDrift(mk([["darwin", { w: 1280, h: 720 }], ["linux", { w: 1280, h: 720 }]]))).toEqual([]);
    // A single-platform family cannot disagree with itself, which is why VB3 also
    // requires at least one family to have two platforms committed.
    expect(dimensionDrift(mk([["darwin", { w: 1280, h: 720 }]]))).toEqual([]);
  });

  it("VB2 rejects a truncated or non-PNG file instead of reading 0x0", () => {
    expect(pngDims(Buffer.from("not a png at all, really"))).toBeNull();
    expect(pngDims(Buffer.alloc(4))).toBeNull();
    expect(pngDims(fakePng(1280, 720))).toEqual({ w: 1280, h: 720 });
    const tampered = fakePng(1280, 720);
    tampered.writeUInt8(0x00, 3); // break the signature mid-way
    expect(pngDims(tampered), "a file with a broken signature was measured anyway").toBeNull();
  });

  it("the name parser owns the platform key, including the resolution suffix", () => {
    const p = parseSnapshotName("tests/a11y-visual.spec.ts-snapshots/landing-main-chrome-1280x720-darwin.png");
    expect(p).toEqual({ family: "tests/a11y-visual.spec.ts-snapshots", key: "landing-main@1280x720", platform: "darwin" });
    expect(parseSnapshotName("tests/a11y-visual.spec.ts-snapshots/README.md")).toBeNull();
  });
});
