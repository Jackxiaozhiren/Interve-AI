// One type scale, or none at all.
//
// Measured 2026-11-02, before this file existed: 300 arbitrary `text-[Npx]`
// utilities across src/**/*.tsx, spread over fifteen values (15px×61, 13px×55,
// 11px×55, 14px×45, 10px×34, 12px×25, 9px×11, plus 8, 14.5, 11.5, 16, 17, 18,
// 22), and not a single use of Tailwind's own text-sm / base / lg. Two labels of
// the same rank could differ by one pixel for no reason anyone could name, which
// is precisely what "统一字体规范" has to mean in practice.
//
// src/app/globals.css now declares seven steps (`text-ui-2xs` … `text-ui-2xl`).
// This file is the ratchet: the arbitrary ones may only decrease. A ceiling is
// not a target — it is a count that stops going up while the surface-by-surface
// work happens.
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const FILES = execFileSync("git", ["ls-files", "src"], { encoding: "utf8" })
  .split("\n")
  .filter((f) => f.endsWith(".tsx"));

/** 2026-11-02, after /login and /signup were moved onto the scale. Only down. */
const ARBITRARY_SIZE_CEILING = 300;

function count(pattern: RegExp): number {
  let n = 0;
  for (const rel of FILES) {
    const src = readFileSync(rel, "utf8");
    n += (src.match(pattern) ?? []).length;
  }
  return n;
}

describe("type scale", () => {
  it("keeps arbitrary font sizes from growing", () => {
    const now = count(/text-\[[0-9.]+px\]/g);
    expect(now, `arbitrary text-[Npx] utilities; use a text-ui-* step instead`).toBeLessThanOrEqual(
      ARBITRARY_SIZE_CEILING,
    );
  });

  it("keeps the scale in use, so the ceiling above cannot be met by deleting type", () => {
    const adopted = count(/text-ui-(2xs|xs|sm|base|lg|xl|2xl)/g);
    expect(adopted, "no file uses the type scale — the tokens are decorative").toBeGreaterThanOrEqual(8);
  });

  it("the scan reads real files", () => {
    expect(FILES.length, "no tsx files found — the counts above would both be zero").toBeGreaterThan(100);
  });
});
