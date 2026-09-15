// Phase 11: metric correctness against hand-computed values.
import { describe, it, expect } from "vitest";
import { weightedKappaQuadratic, spearman, mae, exactAdjacentAgreement, stdev } from "../../src/ai/evals/metrics";

describe("weightedKappaQuadratic", () => {
  it("is 1.0 on perfect agreement", () => {
    expect(weightedKappaQuadratic([1, 2, 3, 4, 5], [1, 2, 3, 4, 5])).toBeCloseTo(1);
  });

  it("matches a hand-computed 2-category case (0.6)", () => {
    // Confusion [[4,1],[1,4]] n=10: po=0.8; E uniform 2.5s;
    // weighted disagreement obs=(1+1)/10=0.2, exp=(2.5+2.5)/10=0.5.
    const a = [1, 1, 1, 1, 1, 2, 2, 2, 2, 2];
    const b = [1, 1, 1, 1, 2, 1, 2, 2, 2, 2];
    expect(weightedKappaQuadratic(a, b, 2)).toBeCloseTo(0.6, 10);
  });

  it("is symmetric and bounded", () => {
    const a = [5, 4, 3, 2, 1, 3, 3, 4];
    const b = [4, 4, 3, 1, 2, 3, 5, 4];
    const ab = weightedKappaQuadratic(a, b);
    expect(ab).toBeCloseTo(weightedKappaQuadratic(b, a), 12);
    expect(ab).toBeGreaterThanOrEqual(-1);
    expect(ab).toBeLessThanOrEqual(1);
  });

  it("returns NaN on empty/mismatched input, never throws", () => {
    expect(weightedKappaQuadratic([], [])).toBeNaN();
    expect(weightedKappaQuadratic([1], [1, 2])).toBeNaN();
  });
});

describe("spearman", () => {
  it("matches hand-computed values", () => {
    expect(spearman([1, 2, 3], [1, 2, 3])).toBeCloseTo(1);
    expect(spearman([1, 2, 3], [3, 2, 1])).toBeCloseTo(-1);
    // d^2 = 0+1+1 = 2, n = 3 → 1 - 12/24 = 0.5
    expect(spearman([1, 2, 3], [1, 3, 2])).toBeCloseTo(0.5);
  });

  it("handles ties without crashing", () => {
    const v = spearman([1, 1, 2, 3], [1, 2, 2, 3]);
    expect(Number.isFinite(v)).toBe(true);
  });
});

describe("mae / agreement / stdev", () => {
  it("mae averages absolute error", () => {
    expect(mae([1, 2, 3], [1, 2, 4])).toBeCloseTo(1 / 3);
  });

  it("exact/adjacent agreement fractions", () => {
    expect(exactAdjacentAgreement([1, 2, 3], [1, 3, 5])).toEqual({ exact: 1 / 3, adjacent: 2 / 3 });
  });

  it("stdev is 0 on constants", () => {
    expect(stdev([4, 4, 4])).toBe(0);
    expect(stdev([])).toBeNaN();
  });
});
