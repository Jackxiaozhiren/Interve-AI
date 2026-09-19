// Phase A1: rater-pack scorer math (keyless; hand-verified anchors).
import { describe, it, expect } from "vitest";
import {
  fleissKappaQuadratic,
  krippendorffAlphaOrdinal,
  parseScoreSheet,
  scoreSheets,
} from "../../scripts/score-rater-pack.mjs";

describe("fleissKappaQuadratic", () => {
  it("matches a hand-computed 2-category case (κ = -1/3)", () => {
    // S1: A,A (agree=1). S2: A,B (agree=0). Po=0.5; pA=3/4, pB=1/4;
    // Pe=(3/4)²+(1/4)²=0.625. κ=(0.5-0.625)/(1-0.625)=-1/3.
    // (k=2 quadratic weights == unweighted, so this anchors both paths.)
    const r = fleissKappaQuadratic([[0, 0], [0, 1]], 2);
    expect(r.subjectsUsed).toBe(2);
    expect(r.kappa).toBeCloseTo(-1 / 3, 10);
  });

  it("is 1.0 on perfect agreement and counts usable subjects only", () => {
    expect(fleissKappaQuadratic([[0, 0], [1, 1], [4, 4]], 5).kappa).toBeCloseTo(1, 10);
    const partial = fleissKappaQuadratic([[0, 0], [0, null], [null]], 5);
    expect(partial.subjectsUsed).toBe(1);
    expect(partial.subjectsTotal).toBe(3);
  });

  it("stays NaN when degenerate (no usable subjects / single category)", () => {
    expect(fleissKappaQuadratic([[], [null]], 5).kappa).toBeNaN();
    expect(fleissKappaQuadratic([[0, 0]], 1).kappa).toBeNaN();
  });
});

describe("krippendorffAlphaOrdinal", () => {
  it("matches a hand-computed binary case (α = 0)", () => {
    // S1 (A,A): o_AA+=2. S2 (A,B): o_AB+=1, o_BA+=1. n=4, nA=3, nB=1.
    // Do=(0+1+1+0)/4=0.5; De=(3·1+1·3)/12=0.5. α=1-0.5/0.5=0.
    const r = krippendorffAlphaOrdinal([[0, 0], [0, 1]], 2);
    expect(r.pairable).toBe(4);
    expect(r.alpha).toBeCloseTo(0, 10);
  });

  it("is 1.0 on perfect agreement (any rater count, any k)", () => {
    expect(krippendorffAlphaOrdinal([[3, 3, 3], [0, 0, 0]], 5).alpha).toBeCloseTo(1, 10);
  });

  it("penalizes far misses more than near misses (ordinal, not nominal)", () => {
    const near = krippendorffAlphaOrdinal([[0, 1], [2, 3]], 5).alpha;
    const far = krippendorffAlphaOrdinal([[0, 4], [0, 4]], 5).alpha;
    expect(near).toBeGreaterThan(far);
  });
});

describe("parseScoreSheet + scoreSheets end to end", () => {
  const sheet1 = `rater_id,case_id,item,value
rater-1,interview-technical-weak-01,correctness,2
rater-1,interview-technical-weak-01,READINESS,developing
rater-1,practice-q1,SCORE,72
rater-1,interview-technical-weak-01,EMPTY,
`;
  const sheet2 = `rater_id,case_id,item,value
rater-2,interview-technical-weak-01,correctness,3
rater-2,interview-technical-weak-01,READINESS,developing
rater-2,practice-q1,SCORE,78
`;

  it("parses long format, skipping the header (blanks kept for the scorer to skip)", () => {
    const rows = parseScoreSheet(sheet1);
    expect(rows.length).toBe(4);
    expect(rows[0]).toEqual({ rater: "rater-1", caseId: "interview-technical-weak-01", item: "correctness", value: "2" });
    expect(rows[3].value).toBe("");
  });

  it("scores dimensions/readiness/practice with advisory + worst-first table", () => {
    const r = scoreSheets([sheet1, sheet2]);
    expect(r.nRaters).toBe(2);
    expect(r.nInvalid).toBe(0);
    expect(r.dimensions.map((d) => d.item)).toContain("correctness");
    expect(r.readiness).not.toBeNull();
    // Single unanimous subject => chance agreement is 1 => κ undefined (NaN).
    // Real packs have 12 subjects; NaN here documents the degenerate edge.
    expect(r.readiness!.kappa).toBeNaN();
    // Single split subject (2 vs 3, k=5): Po=15/16, Pe=31/32 => κ=-1 exactly.
    expect(r.meanDimKappa).toBeCloseTo(-1, 10);
    expect(r.graduationAdvisory).toMatch(/ADVISORY HOLD/);
    expect(r.practiceScores).toHaveLength(1);
    expect(r.practiceScores[0].meanAbsDiff).toBeCloseTo(6, 10);
    expect(r.practiceScores[0].within10).toBe(1);
    // Worst-first: the split correctness cell (agree=0.75) precedes READINESS (agree=1).
    expect(r.disagreements[0].item).toBe("correctness");
  });

  it("flags invalid values without throwing", () => {
    const bad = `rater_id,case_id,item,value\nrater-1,interview-x,correctness,9\nrater-2,interview-x,correctness,2\n`;
    const r = scoreSheets([bad]);
    expect(r.nInvalid).toBe(1);
  });
});
