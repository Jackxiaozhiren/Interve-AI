import { describe, expect, it } from "vitest";
import { readRepo, walkRepo } from "./repo-tree";

/**
 * A `useState` slot destructured with an elided getter is unreachable by
 * construction: the value can only be written, never read. Each write still
 * schedules a render. Two of these were live in the app —
 * src/app/setup/page.tsx wrote the audio level from inside a
 * requestAnimationFrame loop (a render of a 1500-line component every frame,
 * for a number nobody displayed; the waveform is drawn by
 * WaveformVisualizer off its own loop), and magnetic-wrapper re-rendered on
 * every hover.
 *
 * no-unused-vars cannot catch this: the setter IS used. So the rule lives here.
 */
const WRITE_ONLY_SLOT = /const\s*\[\s*,\s*(set[A-Z]\w*)\s*\]\s*=\s*useState/g;

const findSrc = () => walkRepo("src", (rel) => /\.(ts|tsx)$/.test(rel));

function scan(text: string): string[] {
  return (text.match(WRITE_ONLY_SLOT) ?? []).map((m) => m.replace(/\s+/g, " ").trim());
}

function violations(): string[] {
  const found: string[] = [];
  for (const file of findSrc()) {
    const lines = readRepo(file).split("\n");
    lines.forEach((line, i) => {
      if (scan(line).length > 0) found.push(`${file}:${i + 1}`);
    });
  }
  return found;
}

describe("the probe itself (no confident zeros about code it never opened)", () => {
  it("recognises the pattern it claims to forbid", () => {
    expect(scan("  const [, setAudioLevel] = useState(0);")).toHaveLength(1);
  });

  it("leaves a normal slot alone", () => {
    expect(scan("  const [audioLevel, setAudioLevel] = useState(0);")).toEqual([]);
  });
});

describe("repo invariant", () => {
  it("no state slot is written without a reader", () => {
    expect(violations(), `write-only useState at: ${violations().join(", ")}`).toEqual([]);
  });
});
