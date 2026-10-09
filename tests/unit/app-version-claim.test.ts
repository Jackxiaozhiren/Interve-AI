/**
 * The launch badge may only state a version the repository itself declares.
 *
 * Both hero pills said the product was on a major that nothing else in the repo
 * agreed with: `package.json` is 1.0.0, `git tag` has no release tag, and
 * `gh release list` is empty. A visitor reading a version number has no way to
 * tell a real release from decoration, and nothing in the suite was able to tell
 * either — so the number drifted from the manifest the moment it was written,
 * in two files at once.
 *
 * These predicates make the claim single-owned: one constant, pinned to the
 * manifest, and no JSX text node allowed to carry a version digit of its own.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { APP_VERSION } from "../../src/lib/app-version";

const ROOT = path.resolve(import.meta.dirname, "../..");
const HEROS = ["src/components/home/HeroSection.tsx", "src/app/landing/page.tsx"];

const read = (rel: string) => readFileSync(path.join(ROOT, rel), "utf8");

function tsxFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const abs = path.join(dir, entry);
    if (statSync(abs).isDirectory()) tsxFiles(abs, out);
    else if (entry.endsWith(".tsx")) out.push(path.relative(ROOT, abs));
  }
  return out;
}

describe("the version the badge states", () => {
  it("is the version the manifest declares", () => {
    const pkg = JSON.parse(read("package.json"));
    expect(APP_VERSION).toBe(pkg.version);
  });

  it("is a real semver, not a bare major", () => {
    expect(APP_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
  });
});

describe("no copy may carry a version of its own", () => {
  // Scanned over every .tsx under src/, not just the two known pills: a third
  // homepage or a footer that invents its own number is the same defect.
  // The interpolating form is `Interve AI v${APP_VERSION}`, where a `$` follows
  // the `v` — so this pattern only ever matches a typed-in digit.
  const offenders = tsxFiles(path.join(ROOT, "src")).filter((rel) =>
    /Interve AI v?\d/.test(read(rel))
  );

  it("finds no hardcoded brand-plus-number text node anywhere in src/", () => {
    expect(offenders).toEqual([]);
  });

  it("still finds the pattern when one is reintroduced (the scan is not blind)", () => {
    expect(/Interve AI v?\d/.test("        Interve AI 2.0 现已发布")).toBe(true);
    expect(/Interve AI v?\d/.test("{`Interve AI v${APP_VERSION} 现已发布`}")).toBe(false);
  });
});

describe("both heroes render from the one constant", () => {
  it.each(HEROS)("%s interpolates instead of retyping", (rel) => {
    expect(read(rel)).toMatch(/Interve AI v\$\{APP_VERSION\}/);
  });

  it("has both files importing the owner", () => {
    for (const rel of HEROS) {
      expect(read(rel)).toMatch(/from "@\/lib\/app-version"/);
    }
  });
});
