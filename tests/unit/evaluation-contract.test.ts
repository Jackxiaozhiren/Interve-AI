// Phase 4: evaluation contract tests (8.2-8.6).
import { describe, it, expect } from "vitest";
import {
  EvaluationV2Schema,
  READINESS_DISCLAIMER,
  READINESS_LEVELS,
  dimensionScore100,
  overallConfidence,
  evaluationAverage,
} from "../../src/ai/evaluation-contract";
import {
  buildEvaluationSystemPrompt,
  buildEvaluationUserPrompt,
} from "../../src/ai/prompts/evaluation";
import { behavioralRubric } from "../../src/ai/rubrics";

function validDimension(overrides = {}) {
  return {
    id: "relevance",
    score: 4,
    evidence: ["I led the migration of three services"],
    rationale: "Direct evidence of ownership with specifics.",
    confidence: "high",
    improvement: "Quantify the migration outcome next time.",
    ...overrides,
  };
}

function validEvaluation(overrides = {}) {
  return {
    version: "2.0",
    rubricId: "behavioral-v1",
    readiness: "developing",
    readinessRationale: "Solid specifics, thin on quantified impact.",
    dimensions: [validDimension()],
    strengths: ["Concrete examples"],
    weaknesses: ["Unquantified impact"],
    nextDrills: ["Rewrite one answer with metrics"],
    qaReview: [],
    ...overrides,
  };
}

describe("EvaluationV2Schema", () => {
  it("accepts a valid evaluation", () => {
    expect(EvaluationV2Schema.safeParse(validEvaluation()).success).toBe(true);
  });

  it("REJECTS dimensions without evidence (no number without proof)", () => {
    const bad = validEvaluation({ dimensions: [validDimension({ evidence: [] })] });
    expect(EvaluationV2Schema.safeParse(bad).success).toBe(false);
  });

  it("REJECTS out-of-anchor scores (model must not invent scales)", () => {
    expect(EvaluationV2Schema.safeParse(validEvaluation({ dimensions: [validDimension({ score: 0 })] })).success).toBe(false);
    expect(EvaluationV2Schema.safeParse(validEvaluation({ dimensions: [validDimension({ score: 6 })] })).success).toBe(false);
    expect(EvaluationV2Schema.safeParse(validEvaluation({ dimensions: [validDimension({ score: 4.5 })] })).success).toBe(false);
  });

  it("has no hire/culture fields in the contract", () => {
    const shape = Object.keys(EvaluationV2Schema.shape);
    for (const banned of ["hireVerdict", "councilDebate", "cultureFitAdvisor", "culturalTraits"]) {
      expect(shape).not.toContain(banned);
    }
    expect(READINESS_LEVELS).toEqual(["needs_foundation", "developing", "interview_ready", "strongly_prepared"]);
    expect(READINESS_DISCLAIMER).toMatch(/not an employment decision/);
  });
});

describe("score helpers", () => {
  it("derives 0-100 deterministically", () => {
    expect(dimensionScore100({ score: 1 })).toBe(20);
    expect(dimensionScore100({ score: 5 })).toBe(100);
  });

  it("overall confidence is the weakest link", () => {
    expect(overallConfidence([{ confidence: "high" }, { confidence: "high" }])).toBe("high");
    expect(overallConfidence([{ confidence: "high" }, { confidence: "medium" }])).toBe("medium");
    expect(overallConfidence([{ confidence: "medium" }, { confidence: "low" }])).toBe("low");
  });

  it("averages deterministic scores", () => {
    expect(evaluationAverage([{ score: 4 }, { score: 5 }])).toBe(90);
    expect(evaluationAverage([])).toBe(0);
  });
});

describe("prompt builder", () => {
  it("inlines anchors and hard constraints, bans verdicts", () => {
    const sys = buildEvaluationSystemPrompt(behavioralRubric);
    expect(sys).toContain("STAR Completeness");
    expect(sys).toContain("[5 Exemplary]");
    expect(sys).toMatch(/evidence/i);
    expect(sys).toMatch(/FORBIDDEN/);
    expect(sys).toMatch(/hire\/no-hire/);
    expect(sys).toMatch(/not an employment decision/);
    const user = buildEvaluationUserPrompt([{ role: "user", content: "hi" }], "behavioral");
    expect(user).toContain("No evidence => score 1");
  });
});
