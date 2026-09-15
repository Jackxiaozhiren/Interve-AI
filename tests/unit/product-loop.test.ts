// Phase 7: taxonomy + plan/gap + drills + retry-link unit tests.
import { describe, it, expect } from "vitest";
import { INTERVIEW_TYPES, getInterviewType, INTERVIEW_TYPE_VERSION } from "../../src/ai/interview/types";
import { buildGapMatrix, buildInterviewPlan } from "../../src/ai/interview/plan";
import { DRILL_BANK, drillsForWeaknesses, DRILL_BANK_VERSION } from "../../src/ai/drills/bank";
import { decodeRetryQuestion, retryPracticeHref } from "../../src/lib/retry-link";
import { behavioralRubric } from "../../src/ai/rubrics";

describe("interview taxonomy (12.2)", () => {
  it("has 11 unique versioned types mapped to real rubrics", () => {
    expect(INTERVIEW_TYPES).toHaveLength(11);
    const ids = INTERVIEW_TYPES.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(INTERVIEW_TYPE_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
    for (const t of INTERVIEW_TYPES) {
      expect(["behavioral-v1", "technical-v1", "system-design-v1", "data-ml-v1", "general-v1"]).toContain(t.rubricId);
    }
  });

  it("coding/system-design flag their tooling", () => {
    expect(getInterviewType("coding").needsCoding).toBe(true);
    expect(getInterviewType("system-design").needsWhiteboard).toBe(true);
    expect(getInterviewType("behavioral").needsCoding).toBe(false);
  });

  it("unknown ids fall back safely (never crash setup)", () => {
    expect(getInterviewType("nope").id).toBe("recruiter-screen");
    expect(getInterviewType(undefined).id).toBe("recruiter-screen");
  });
});

describe("gap matrix (12.3)", () => {
  const dims = behavioralRubric.dimensions.map((d) => ({ id: d.id, name: d.name }));

  it("marks strengths/gaps, never invents rows", () => {
    const rows = buildGapMatrix({ strengths: ["Ownership"], gaps: ["Metrics"], rubricDimensions: dims });
    expect(rows.find((r) => r.skill === "Ownership")?.status).toBe("strength");
    expect(rows.find((r) => r.skill === "Metrics")?.status).toBe("gap");
    // Rubric dims not mentioned stay unknown — not gaps.
    expect(rows.find((r) => r.skill === "Reflection")?.status).toBe("unknown");
  });

  it("dedupes case-insensitively", () => {
    const rows = buildGapMatrix({ strengths: ["Ownership"], gaps: ["ownership"], rubricDimensions: [] });
    expect(rows).toHaveLength(1);
  });

  it("builds a prioritized plan (gaps first, then coverage)", () => {
    const plan = buildInterviewPlan({
      interviewTypeId: "behavioral",
      rubricId: "behavioral-v1",
      rubricDimensions: dims,
      difficulty: "medium",
      timeBudgetSec: 900,
      strengths: ["Ownership"],
      gaps: ["Metrics", "Reflection"],
    });
    expect(plan.focusAreas[0]).toBe("Metrics");
    expect(plan.ungrounded).toBe(false);
    expect(plan.focusAreas.length).toBeLessThanOrEqual(4);
  });

  it("flags ungrounded plans honestly", () => {
    const plan = buildInterviewPlan({
      interviewTypeId: "custom", rubricId: "general-v1", rubricDimensions: [],
      difficulty: "medium", timeBudgetSec: 900,
    });
    expect(plan.ungrounded).toBe(true);
  });
});

describe("drill bank (14)", () => {
  it("covers every rubric dimension exactly once", () => {
    const got = new Set(DRILL_BANK.map((d) => d.id));
    const want: string[] = [];
    for (const [rubricId, dims] of [
      ["behavioral-v1", ["relevance", "star_completeness", "specificity", "ownership", "impact", "reflection"]],
      ["technical-v1", ["correctness", "decomposition", "assumptions", "tradeoffs", "depth", "communication"]],
      ["system-design-v1", ["clarification", "architecture", "scalability", "reliability", "tradeoffs", "communication"]],
      ["data-ml-v1", ["framing", "data_assumptions", "modeling", "evaluation", "experimentation", "deployment"]],
      ["general-v1", ["relevance", "specificity", "depth", "communication"]],
    ] as const) {
      for (const dim of dims) want.push(`${rubricId}:${dim}`);
    }
    expect(got.size).toBe(want.length);
    for (const id of want) expect(got, id).toContain(id);
  });

  it("drillsForWeaknesses picks weakest first, capped", () => {
    const out = drillsForWeaknesses([
      { id: "impact", rubricId: "behavioral-v1", score: 2 },
      { id: "relevance", rubricId: "behavioral-v1", score: 5 },
      { id: "reflection", rubricId: "behavioral-v1", score: 1 },
    ], 2);
    expect(out.map((d) => d.dimensionId)).toEqual(["reflection", "impact"]);
  });

  it("falls back to general drills for unknown rubric dims", () => {
    const out = drillsForWeaknesses([{ id: "relevance", rubricId: "nope-v9", score: 1 }], 3);
    expect(out).toHaveLength(1);
    expect(out[0]?.rubricId).toBe("general-v1");
  });

  it("is versioned with real content", () => {
    expect(DRILL_BANK_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
    for (const d of DRILL_BANK) {
      expect(d.task.length).toBeGreaterThan(30);
      expect(d.tip.length).toBeGreaterThan(10);
    }
  });
});

describe("retry links (Replay → Retry)", () => {
  it("round-trips unicode question text", () => {
    const q = "你如何处理线上故障？Describe STAR 结果！";
    const href = retryPracticeHref(q);
    expect(href.startsWith("/practice?retry=")).toBe(true);
    expect(decodeRetryQuestion(href.split("=")[1])).toBe(q);
  });

  it("rejects garbage", () => {
    expect(decodeRetryQuestion("!!!")).toBeNull();
    expect(decodeRetryQuestion("")).toBeNull();
  });
});
