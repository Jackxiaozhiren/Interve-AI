// EVALUATION_V2 §9: practice-attempt grounding persists per attempt and the
// StarTracker carries it accessibly (tooltip + sr-only, never a new visual score).
import { describe, it, expect } from "vitest";
import { normalizeAttemptGrounding } from "../../src/app/practice/[id]/client";
import { starGroundingTitle } from "../../src/components/interview/StarTracker";

describe("practice attempt grounding (§9)", () => {
  it("normalizeAttemptGrounding keeps/caps/drops/never-throws", () => {
    expect(normalizeAttemptGrounding({ evidence: ["a", "b"], confidence: "high" })).toEqual({
      evidence: ["a", "b"], confidence: "high",
    });
    // Cap mirrors the schema max (5): longer arrays truncate, never reject.
    expect(
      normalizeAttemptGrounding({ evidence: ["1", "2", "3", "4", "5", "6"], confidence: "low" })
    ).toEqual({ evidence: ["1", "2", "3", "4", "5"], confidence: "low" });
    expect(normalizeAttemptGrounding({ evidence: ["ok", 42, null, ""], confidence: "bogus" })).toEqual({
      evidence: ["ok"], confidence: "medium",
    });
    expect(normalizeAttemptGrounding(undefined)).toEqual({ evidence: [], confidence: "medium" });
    expect(normalizeAttemptGrounding(null)).toEqual({ evidence: [], confidence: "medium" });
    expect(normalizeAttemptGrounding("nope")).toEqual({ evidence: [], confidence: "medium" });
  });

  it("practice schema cap is 5 (the client cap it mirrors)", async () => {
    const { PracticeOutputSchema } = await import("../../src/app/api/analyze-practice/route");
    const base = { score: 80, strengths: ["s"], improvements: ["i"] };
    // 5 quotes validate; 6 are rejected server-side (client pre-truncates).
    expect(() =>
      PracticeOutputSchema.parse({ ...base, evidence: ["1", "2", "3", "4", "5", "6"] })
    ).toThrow();
    const ok = PracticeOutputSchema.parse({ ...base, evidence: ["a"] }) as { evidence: string[] };
    expect(ok.evidence).toEqual(["a"]);
  });

  it("snake/camel converters preserve the new attempt columns", async () => {
    const { toSnakeCase, toCamelCase } = await import("../../src/lib/api-client");
    const row = {
      questionId: "q1", score: 80, evidence: ["I shipped it"], confidence: "high",
      createdAt: new Date("2026-09-15T00:00:00Z"),
    };
    const roundTripped = toCamelCase(toSnakeCase(row)) as typeof row;
    expect(roundTripped.evidence).toEqual(["I shipped it"]);
    expect(roundTripped.confidence).toBe("high");
    // Old rows without the columns survive the round trip untouched.
    const legacy = toCamelCase(toSnakeCase({ questionId: "q0", score: 70 })) as Record<string, unknown>;
    expect("evidence" in legacy).toBe(false);
    expect("confidence" in legacy).toBe(false);
  });

  it("starGroundingTitle: undefined when empty, LiveStats copy pattern otherwise", () => {
    expect(starGroundingTitle([], "medium")).toBeUndefined();
    expect(starGroundingTitle(["I led the migration"], "high")).toBe(
      "Basis in your answer: “I led the migration” · Evaluator confidence: high (evidence sufficiency)"
    );
    expect(starGroundingTitle(["a", "b", "c"], "low")).toBe(
      "Basis in your answer: “a” (+2 more) · Evaluator confidence: low (evidence sufficiency)"
    );
  });
});
