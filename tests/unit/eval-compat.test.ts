// Phase 4: eval-compat adapter tests (legacy preservation + V2 views).
import { describe, it, expect } from "vitest";
import { toEvaluationView, sessionScore } from "../../src/lib/eval-compat";
import type { Interview } from "../../src/lib/db";

function base(): Interview {
  return { status: "completed", createdAt: new Date(), updatedAt: new Date() };
}

const V2_ROW: Interview = {
  ...base(),
  evaluationV2: {
    version: "2.0",
    rubricId: "behavioral-v1",
    readiness: "interview_ready",
    readinessRationale: "Consistent STAR structure with metrics.",
    dimensions: [
      { id: "relevance", score: 4, evidence: ["we shipped in June"], rationale: "On point.", confidence: "high", improvement: "Tighten scope." },
      { id: "impact", score: 5, evidence: ["cut latency 40%"], rationale: "Quantified.", confidence: "high", improvement: "None." },
    ],
    strengths: ["Specificity"],
    weaknesses: ["Reflection"],
    nextDrills: ["Add a reflection close"],
    qaReview: [],
  },
};

const LEGACY_ROW: Interview = {
  ...base(),
  radarScores: { logic: 80, expression: 70, professionalism: 75, confidence: 65, pressure: 60, bodyLanguage: 90 },
  hireVerdict: "hire",
  verdictRationale: "Solid overall.",
  qaReview: [],
};

describe("toEvaluationView", () => {
  it("maps V2 rows with deterministic scores", () => {
    const v = toEvaluationView(V2_ROW);
    expect(v.kind).toBe("v2");
    expect(v.legacy).toBe(false);
    expect(v.readinessLabel).toBe("interview_ready");
    expect(v.average).toBe(90); // (80+100)/2
    expect(v.confidence).toBe("high");
    expect(v.dimensions[0]?.score100).toBe(80);
    expect(v.dimensions[0]?.anchorLevel).toBe(4);
    expect(v.nextDrills).toEqual(["Add a reflection close"]);
  });

  it("maps legacy rows with explicit legacy flags (history preserved)", () => {
    const v = toEvaluationView(LEGACY_ROW);
    expect(v.kind).toBe("legacy");
    expect(v.legacy).toBe(true);
    expect(v.readinessLabel).toMatch(/legacy/i);
    expect(v.average).toBe(73); // (80+70+75+65+60+90)/6 = 73.3
    expect(v.confidence).toBe("low");
    expect(v.disclaimer).toMatch(/Legacy/);
    expect(v.dimensions).toHaveLength(6);
    expect(v.dimensions.every((d) => d.anchorLevel === null)).toBe(true);
  });

  it("returns none for empty rows", () => {
    const v = toEvaluationView(base());
    expect(v.kind).toBe("none");
    expect(v.average).toBeNull();
  });
});

describe("sessionScore", () => {
  it("unifies V2 and legacy scoring", () => {
    expect(sessionScore(V2_ROW)).toBe(90);
    expect(sessionScore(LEGACY_ROW)).toBe(73);
    expect(sessionScore(base())).toBeNull();
  });
});
