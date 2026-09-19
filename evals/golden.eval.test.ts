// Phase 11: golden agreement suite (27.1, 27.2). KEYED — skips without env.
import { describe, it, expect } from "vitest";
import golden from "./golden.json";
import { evalEnv, evaluateTranscript } from "./runner";
import { weightedKappaQuadratic, spearman, mae, exactAdjacentAgreement } from "../src/ai/evals/metrics";

const env = evalEnv(12); // Phase C1: 12 golden cases × 1 call per run
const suite = env.ready ? describe : describe.skip;

interface GoldenCase {
  id: string;
  framework?: string;
  messages: { role: string; content: string }[];
  expected: { readiness: string; dimensions: Record<string, [number, number]> };
  rubricId: string;
}

const CASES = (golden as unknown as { cases: GoldenCase[] }).cases;

suite("golden agreement (keyed)", () => {
  it("evaluator matches authored bands and readiness", async () => {
    const modelScores: number[] = [];
    const expectedScores: number[] = [];
    for (const c of CASES) {
      const out = await evaluateTranscript(c.messages, c.framework);
      expect(out.readiness, `${c.id}: readiness`).toBe(c.expected.readiness);
      for (const d of out.dimensions) {
        const band = c.expected.dimensions[d.id];
        expect(band, `${c.id}: unexpected dimension ${d.id}`).toBeDefined();
        expect(d.score, `${c.id}/${d.id} in [${band}]`).toBeGreaterThanOrEqual(band[0]);
        expect(d.score, `${c.id}/${d.id} in [${band}]`).toBeLessThanOrEqual(band[1]);
        modelScores.push(d.score);
        expectedScores.push((band[0] + band[1]) / 2);
      }
    }
    // Aggregate agreement vs band midpoints (provisional bars).
    expect(mae(modelScores, expectedScores)).toBeLessThan(1.0);
    expect(exactAdjacentAgreement(modelScores, expectedScores).adjacent).toBeGreaterThan(0.8);
    expect(spearman(modelScores, expectedScores)).toBeGreaterThan(0.5);
    expect(weightedKappaQuadratic(modelScores, expectedScores)).toBeGreaterThan(0.4);
  }, 600_000);
});
