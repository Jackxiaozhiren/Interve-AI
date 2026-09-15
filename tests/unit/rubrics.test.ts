// Phase 4: rubric registry integrity tests (8.1, 8.3).
import { describe, it, expect } from "vitest";
import {
  RUBRICS,
  selectRubricId,
  anchorToScore100,
  behavioralRubric,
  technicalRubric,
  systemDesignRubric,
  dataMlRubric,
  generalRubric,
} from "../../src/ai/rubrics";

describe("rubric registry", () => {
  it("exposes 5 versioned rubrics", () => {
    expect(Object.keys(RUBRICS).sort()).toEqual([
      "behavioral-v1",
      "data-ml-v1",
      "general-v1",
      "system-design-v1",
      "technical-v1",
    ]);
    for (const r of Object.values(RUBRICS)) {
      expect(r.id).toMatch(/-v1$/);
      expect(r.version).toBe("1.0.0");
    }
  });

  it("every dimension has exactly 5 ordered anchors with content", () => {
    for (const r of Object.values(RUBRICS)) {
      expect(r.dimensions.length).toBeGreaterThanOrEqual(4);
      expect(r.dimensions.length).toBeLessThanOrEqual(6);
      for (const dim of r.dimensions) {
        expect(dim.anchors).toHaveLength(5);
        dim.anchors.forEach((a, i) => {
          expect(a.level).toBe(i + 1);
          expect(a.label.length).toBeGreaterThan(0);
          expect(a.description.length).toBeGreaterThan(20);
        });
        const ids = r.dimensions.map((d) => d.id);
        expect(new Set(ids).size).toBe(ids.length);
      }
    }
  });

  it("behavioral rubric covers the six required competencies", () => {
    expect(behavioralRubric.dimensions.map((d) => d.id)).toEqual([
      "relevance", "star_completeness", "specificity", "ownership", "impact", "reflection",
    ]);
  });

  it("technical rubric covers correctness-to-communication", () => {
    expect(technicalRubric.dimensions.map((d) => d.id)).toContain("communication");
    expect(technicalRubric.dimensions.map((d) => d.id)).toContain("tradeoffs");
  });

  it("system-design rubric has no face/emotion dimensions", () => {
    const text = JSON.stringify(systemDesignRubric).toLowerCase();
    for (const banned of ["emotion", "personality", "culture fit", "hire"]) {
      expect(text).not.toContain(banned);
    }
  });

  it("data-ml rubric covers the ML lifecycle", () => {
    expect(dataMlRubric.dimensions.map((d) => d.id)).toEqual([
      "framing", "data_assumptions", "modeling", "evaluation", "experimentation", "deployment",
    ]);
  });

  it("general rubric stays small", () => {
    expect(generalRubric.dimensions).toHaveLength(4);
  });
});

describe("selectRubricId", () => {
  it("maps setup + legacy framework strings", () => {
    expect(selectRubricId("star")).toBe("behavioral-v1");
    expect(selectRubricId("behavioral")).toBe("behavioral-v1");
    expect(selectRubricId("amazon_lps")).toBe("behavioral-v1");
    expect(selectRubricId("google_googliness")).toBe("behavioral-v1");
    expect(selectRubricId("startup_scrappiness")).toBe("behavioral-v1");
    expect(selectRubricId("technical")).toBe("technical-v1");
    expect(selectRubricId("system-design")).toBe("system-design-v1");
    expect(selectRubricId("data-ml")).toBe("data-ml-v1");
  });

  it("defaults unknown/empty frameworks to general", () => {
    expect(selectRubricId(undefined)).toBe("general-v1");
    expect(selectRubricId("")).toBe("general-v1");
    expect(selectRubricId("something-new")).toBe("general-v1");
  });
});

describe("anchorToScore100", () => {
  it("maps 1-5 deterministically and clamps", () => {
    expect([1, 2, 3, 4, 5].map(anchorToScore100)).toEqual([20, 40, 60, 80, 100]);
    expect(anchorToScore100(0)).toBe(20);
    expect(anchorToScore100(99)).toBe(100);
  });
});
