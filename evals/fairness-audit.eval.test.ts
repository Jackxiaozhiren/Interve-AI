/**
 * Produces the artifact the candidate-facing fairness card reads.
 *
 * The card's whole claim is "this number came from a real paired audit", so
 * the producer has to be the same suite the fairness regression already runs:
 * each pair is evaluated twice (variant A and variant B, differing only in a
 * surface token) and a cell counts a flip when the readiness verdict changes.
 *
 * Keyed on purpose: without ZHIPU_API_KEY this self-skips and writes nothing,
 * which is why the shipped artifact starts as "not measured" rather than as a
 * zero. Run it with the key when you want the card to show a reading:
 *
 *   npm run test:eval -- fairness-audit
 *
 * Then commit `src/data/fairness-audit.json`.
 */
import { describe, expect, it } from "vitest";
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import fairnessRaw from "./fairness-pairs.json";
import { evalEnv, evaluateTranscript, drift } from "./runner";

const env = evalEnv(8);
const suite = env.ready ? describe : describe.skip;

interface MiniMsg {
  role: string;
  content: string;
}

const pairs = (
  fairnessRaw as unknown as {
    pairs: { id: string; framework?: string; variantA: MiniMsg[]; variantB: MiniMsg[] }[];
  }
).pairs;

/** Every pair must be classified, or the card would show an internal id. */
const ATTRIBUTE: Record<string, { attribute: string; label: string }> = {
  "fair-name-pronoun-01": { attribute: "name", label: "姓名与代词" },
  "fair-pronoun-02": { attribute: "pronoun", label: "代词" },
  "fair-org-type-01": { attribute: "org-type", label: "机构类型" },
  "fair-gap-framing-01": { attribute: "gap-framing", label: "职业空窗叙事" },
};

suite("fairness audit produces the artifact the report card reads", () => {
  it("classifies every pair before measuring it", () => {
    const unclassified = pairs.map((p) => p.id).filter((id) => !ATTRIBUTE[id]);
    expect(unclassified, "a fairness pair has no attribute mapping, so the card cannot label it").toEqual([]);
  });

  it("measures each pair and writes src/data/fairness-audit.json", async () => {
    const cells = [];
    for (const p of pairs) {
      const a = await evaluateTranscript(p.variantA, p.framework);
      const b = await evaluateTranscript(p.variantB, p.framework);
      const d = drift(a, b);
      cells.push({ ...ATTRIBUTE[p.id], flips: d.readinessFlip ? 1 : 0, n: 1 });
    }

    const runs = cells.reduce((sum, cell) => sum + cell.n, 0);
    const artifact = {
      version: "1.0.0",
      measuredAt: new Date().toISOString(),
      model: process.env.EVAL_MODEL ?? "glm-4-flash",
      runs,
      cells,
    };
    const target = fileURLToPath(new URL("../src/data/fairness-audit.json", import.meta.url));
    writeFileSync(target, `${JSON.stringify(artifact, null, 2)}\n`, "utf8");

    expect(runs).toBe(pairs.length);
    expect(cells.every((cell) => cell.flips <= cell.n)).toBe(true);
  }, 600_000);
});
