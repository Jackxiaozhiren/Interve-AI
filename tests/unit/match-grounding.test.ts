// alignment-canonical decision: shared normalizeGrounding powers the
// alignment→matchData adaptation so setup, store, and practice drift together.
import { describe, it, expect } from "vitest";
import { normalizeGrounding } from "../../src/ai/evidence";

describe("shared normalizeGrounding (alignment→matchData)", () => {
  it("keeps/caps/drops/never-throws", () => {
    expect(normalizeGrounding(["a", "b"], "high")).toEqual({
      evidence: ["a", "b"], confidence: "high",
    });
    // Cap mirrors the alignment/match schema max (6).
    expect(normalizeGrounding(["1", "2", "3", "4", "5", "6", "7"], "low", 6)).toEqual({
      evidence: ["1", "2", "3", "4", "5", "6"], confidence: "low",
    });
    expect(normalizeGrounding(["ok", 42, null, ""], "bogus", 6)).toEqual({
      evidence: ["ok"], confidence: "medium",
    });
    expect(normalizeGrounding(undefined, undefined)).toEqual({ evidence: [], confidence: "medium" });
  });

  it("adapted matchData shape carries grounding without breaking legacy rows", async () => {
    const { MatchOutputSchema } = await import("../../src/app/api/analyze-match/route");
    const base = { overallScore: 80, alignedSkills: ["a"], missingSkills: ["b"], recommendations: ["c"] };
    // Legacy shape (no envelope) still validates via defaults.
    const legacy = MatchOutputSchema.parse(base) as { evidence: string[]; confidence: string };
    expect(legacy.evidence).toEqual([]);
    expect(legacy.confidence).toBe("medium");
    // Grounded shape validates with explicit envelope.
    const grounded = MatchOutputSchema.parse({
      ...base, ...normalizeGrounding(["JD needs caching", "I shipped Redis"], "high", 6),
    }) as { evidence: string[] };
    expect(grounded.evidence).toHaveLength(2);
  });
});
