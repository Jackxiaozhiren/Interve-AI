// Rater-pack generator tests (keyless): structure + blindness.
import { describe, it, expect } from "vitest";
import { execFileSync } from "node:child_process";
import { readFileSync, existsSync, readdirSync, mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT = fileURLToPath(new URL("../../scripts/rater-pack.mjs", import.meta.url));
const golden = JSON.parse(readFileSync(new URL("../../evals/golden.json", import.meta.url), "utf8"));

function gen(out: string, raters = 2) {
  execFileSync(process.execPath, [SCRIPT, "--out", out, "--raters", String(raters)], { stdio: "pipe" });
}

describe("rater-pack generator", () => {
  it("emits README + blind cases + per-rater sheets", () => {
    const out = mkdtempSync(join(tmpdir(), "rater-pack-"));
    gen(out);
    expect(existsSync(join(out, "README.md"))).toBe(true);
    const cases = readdirSync(join(out, "cases"));
    expect(cases.length).toBeGreaterThanOrEqual(12 + 5);
    for (const n of ["sheet-rater-1.csv", "sheet-rater-2.csv"]) {
      const sheet = readFileSync(join(out, "scores", n), "utf8");
      expect(sheet.split("\n")[0]).toBe("rater_id,case_id,item,value");
    }
  });

  it("score-rater-pack.mjs scores filled sheets (κ/α dual report, exit 0)", () => {
    const out = mkdtempSync(join(tmpdir(), "rater-score-"));
    const scores = join(out, "scores");
    mkdirSync(scores, { recursive: true });
    const sheet = (r: string, dim: string, readiness: string, score: number) =>
      `rater_id,case_id,item,value\n${r},interview-c1,correctness,${dim}\n${r},interview-c1,READINESS,${readiness}\n${r},practice-q1,SCORE,${score}\n`;
    writeFileSync(join(scores, "sheet-rater-1.csv"), sheet("rater-1", "2", "developing", 70));
    writeFileSync(join(scores, "sheet-rater-2.csv"), sheet("rater-2", "3", "developing", 76));
    const scorer = fileURLToPath(new URL("../../scripts/score-rater-pack.mjs", import.meta.url));
    const logged = execFileSync(process.execPath, [scorer, scores], { encoding: "utf8" });
    expect(logged).toContain("raters=2");
    expect(logged).toMatch(/κ=.*α=/);
    expect(logged).toMatch(/ADVISORY/);
    expect(logged).toContain("practice-q1");
  });

  it("case files are blind (no authored readiness/bands leak)", () => {
    const out = mkdtempSync(join(tmpdir(), "rater-pack-blind-"));
    gen(out);
    for (const c of golden.cases as { id: string; expected: { readiness: string } }[]) {
      const text = readFileSync(join(out, "cases", `interview-${c.id}.md`), "utf8");
      expect(text, `${c.id}: transcript present`).toMatch(/\*\*(user|assistant):\*\*/);
      // The authored verdict must not appear — raters score from transcript.
      // (Transcripts are synthetic; none contain these level tokens.)
      expect(text, `${c.id}: blind to ${c.expected.readiness}`).not.toContain(c.expected.readiness);
      expect(text, `${c.id}: no band leak`).not.toMatch(/scoreBand|avgProgressBand/);
    }
  });
});
