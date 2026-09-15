// Phase 4: lane classification contract — every versioned prompt must be
// classified as evidence-graded, steering-signal, or advisory, so a future
// lane cannot silently start emitting ungrounded user-facing scores.
import { describe, it, expect } from "vitest";
import { PROMPT_REGISTRY } from "../../src/ai/prompts";
import { EVIDENCE_GRADED, STEERING_SIGNALS, ADVISORY, laneClassOf } from "../../src/ai/lanes";

describe("lane classification", () => {
  it("covers every registered prompt exactly once", () => {
    const ids = PROMPT_REGISTRY.map((p) => p.id);
    const classified = [...EVIDENCE_GRADED, ...STEERING_SIGNALS, ...ADVISORY];
    expect([...classified].sort()).toEqual([...ids].sort());
    expect(new Set(classified).size).toBe(classified.length);
  });

  it("classifies the evidence-graded lanes (user-facing scores)", () => {
    for (const id of ["evaluation-v2", "analyze-practice", "analyze-alignment", "analyze-match"]) {
      expect(laneClassOf(id)).toBe("evidence-graded");
    }
  });

  it("pins steering signals as loop-only (never evaluations)", () => {
    for (const id of ["analyze-star", "analyze-behavior", "analyze-chunk"]) {
      expect(laneClassOf(id)).toBe("steering-signal");
    }
  });

  it("returns null for unknown ids (fail-closed for new lanes)", () => {
    expect(laneClassOf("analyze-future")).toBeNull();
  });
});

describe("evidence envelope (Phase 4)", () => {
  it("practice/alignment/match prompts demand verbatim evidence + confidence", async () => {
    const { buildPracticeSystem } = await import("../../src/ai/prompts/practice");
    const { buildAlignmentPrompt } = await import("../../src/ai/prompts/alignment");
    const { buildMatchPrompt } = await import("../../src/ai/prompts/match");
    for (const text of [
      buildPracticeSystem(),
      buildAlignmentPrompt({ resumeText: "R", jobDescription: "J" }),
      buildMatchPrompt({ jobDescription: "J" }),
    ]) {
      expect(text).toContain("verbatim");
      expect(text).toContain("confidence");
    }
  });

  it("practice drill loop: bank-constrained ids + server normalize", async () => {
    const { buildPracticeSystem } = await import("../../src/ai/prompts/practice");
    const { normalizePracticeDrills } = await import("../../src/app/api/analyze-practice/route");
    const { DRILL_BANK } = await import("../../src/ai/drills/bank");
    // Prompt offers only real bank ids (spot-check two known ones are listed).
    const system = buildPracticeSystem();
    expect(system).toContain("drillIds");
    expect(system).toContain("behavioral-v1:impact");
    expect(system).toContain("technical-v1:tradeoffs");
    // Normalize keeps known ids (deduped, capped), drops hallucinations, never throws.
    expect(normalizePracticeDrills(["behavioral-v1:impact", "nope:fake", "behavioral-v1:impact", "technical-v1:depth", "general-v1:relevance"])).toEqual([
      "behavioral-v1:impact",
      "technical-v1:depth",
      "general-v1:relevance",
    ]);
    expect(normalizePracticeDrills(undefined)).toEqual([]);
    expect(normalizePracticeDrills("behavioral-v1:impact")).toEqual([]);
    expect(normalizePracticeDrills([42, null])).toEqual([]);
    // Every bank id survives normalization (no false rejections).
    for (const d of DRILL_BANK) {
      expect(normalizePracticeDrills([d.id])).toEqual([d.id]);
    }
  });

  it("practice/alignment/match schemas default evidence + confidence (compat)", async () => {
    const { PracticeOutputSchema } = await import("../../src/app/api/analyze-practice/route");
    const { AlignmentOutputSchema } = await import("../../src/app/api/analyze-alignment/route");
    const { MatchOutputSchema } = await import("../../src/app/api/analyze-match/route");
    for (const schema of [PracticeOutputSchema, AlignmentOutputSchema, MatchOutputSchema]) {
      const parsed = schema.parse(
        schema === PracticeOutputSchema
          ? { score: 80, strengths: ["s"], improvements: ["i"] }
          : schema === AlignmentOutputSchema
            ? { matchScore: 80, strengths: ["s"], gaps: ["g"], recommendedFocus: "f" }
            : { overallScore: 80, alignedSkills: ["s"], missingSkills: ["m"], recommendations: ["r"] }
      ) as { evidence: string[]; confidence: string };
      expect(parsed.evidence).toEqual([]);
      expect(parsed.confidence).toBe("medium");
    }
  });
});

describe("steering envelope (EVALUATION_V2 §7)", () => {
  it("star/behavior/chunk prompts demand verbatim evidence + evaluator confidence", async () => {
    const { buildStarSystem, STAR_PROMPT_VERSION } = await import("../../src/ai/prompts/star");
    const { buildBehaviorSystem, BEHAVIOR_PROMPT_VERSION } = await import("../../src/ai/prompts/behavior");
    const { buildChunkSystem, CHUNK_PROMPT_VERSION } = await import("../../src/ai/prompts/chunk");
    expect(STAR_PROMPT_VERSION).toBe("1.2.0");
    expect(BEHAVIOR_PROMPT_VERSION).toBe("1.1.0");
    expect(CHUNK_PROMPT_VERSION).toBe("1.2.0");
    for (const text of [
      buildStarSystem(),
      buildBehaviorSystem(),
      buildChunkSystem({ role: "R", level: "L" }),
    ]) {
      expect(text).toContain("verbatim");
      expect(text).toContain("confidence");
    }
    // Envelope pins preserved: exact keys, no floor, no psychology.
    expect(buildStarSystem()).toContain("EXACTLY these top-level keys: s, t, a, r");
    expect(buildStarSystem()).not.toContain("at least 40");
    expect(buildBehaviorSystem()).toContain("If completely missing, score 0");
    const chunk = buildChunkSystem({ role: "R", level: "L" });
    expect(chunk).toContain("sentimentScore");
    expect(chunk).toContain("technicalAccuracy");
    expect(chunk).toContain("do NOT infer emotions");
  });

  it("star/behavior/chunk schemas default evidence + confidence (compat)", async () => {
    const { StarOutputSchema } = await import("../../src/app/api/analyze-star/route");
    const { BehaviorOutputSchema } = await import("../../src/app/api/analyze-behavior/route");
    const { ChunkOutputSchema } = await import("../../src/app/api/analyze-chunk/route");
    const star = StarOutputSchema.parse({
      s: { progress: 10, confidence: 10, timeSpentSeconds: 1 },
      t: { progress: 10, confidence: 10, timeSpentSeconds: 1 },
      a: { progress: 10, confidence: 10, timeSpentSeconds: 1 },
      r: { progress: 10, confidence: 10, timeSpentSeconds: 1 },
    }) as { evidence: string[]; confidence: string };
    expect(star.evidence).toEqual([]);
    expect(star.confidence).toBe("medium");
    const behavior = BehaviorOutputSchema.parse({
      leadership: 10, problemSolving: 10, communication: 10,
    }) as { evidence: string[]; confidence: string };
    expect(behavior.evidence).toEqual([]);
    expect(behavior.confidence).toBe("medium");
    const chunk = ChunkOutputSchema.parse({
      sentimentScore: 70, technicalAccuracy: 50,
    }) as { evidence: string[]; confidence: string };
    expect(chunk.evidence).toEqual([]);
    expect(chunk.confidence).toBe("medium");
    // Envelope values survive the schema (not stripped).
    const withEnv = BehaviorOutputSchema.parse({
      leadership: 70, problemSolving: 70, communication: 70,
      evidence: ["I led the migration"], confidence: "high",
    }) as { evidence: string[]; confidence: string };
    expect(withEnv.evidence).toEqual(["I led the migration"]);
    expect(withEnv.confidence).toBe("high");
  });

  it("steering mocks carry non-empty evidence + valid confidence", async () => {
    const { MOCK_PAYLOADS } = await import("../../src/ai/providers/mock");
    for (const key of ["analyze-star", "analyze-behavior", "analyze-chunk"] as const) {
      const payload = MOCK_PAYLOADS[key] as { evidence: unknown; confidence: unknown };
      expect(Array.isArray(payload.evidence) && (payload.evidence as unknown[]).length, key).toBeGreaterThan(0);
      expect(["high", "medium", "low"]).toContain(payload.confidence);
    }
  });

  it("normalizeGrounding keeps/caps/drops/never-throws", async () => {
    const { normalizeGrounding } = await import("../../src/store/useInterveStore");
    expect(normalizeGrounding({ evidence: ["a", "b"], confidence: "high" }, 4)).toEqual({
      evidence: ["a", "b"], confidence: "high",
    });
    expect(normalizeGrounding({ evidence: ["a", "b", "c"], confidence: "low" }, 2).evidence).toEqual(["a", "b"]);
    expect(normalizeGrounding({ evidence: ["ok", 42, null, ""], confidence: "bogus" }, 4)).toEqual({
      evidence: ["ok"], confidence: "medium",
    });
    expect(normalizeGrounding(undefined, 4)).toEqual({ evidence: [], confidence: "medium" });
    expect(normalizeGrounding("nope", 4)).toEqual({ evidence: [], confidence: "medium" });
    expect(normalizeGrounding(null, 4)).toEqual({ evidence: [], confidence: "medium" });
  });

  it("store grounding setters write + reset clears (incl. traits leak fix)", async () => {
    const { useInterveStore } = await import("../../src/store/useInterveStore");
    const store = useInterveStore.getState();
    store.setStarGrounding(["q1"], "high");
    store.setTraitsGrounding(["q2"], "low");
    store.setBehavioralTraits({ leadership: 80, problemSolving: 80, communication: 80 });
    expect(useInterveStore.getState().starEvidence).toEqual(["q1"]);
    expect(useInterveStore.getState().traitsConfidence).toBe("low");
    useInterveStore.getState().reset();
    const after = useInterveStore.getState();
    expect(after.starEvidence).toEqual([]);
    expect(after.starConfidence).toBe("medium");
    expect(after.traitsEvidence).toEqual([]);
    expect(after.behavioralTraits).toEqual({ leadership: 0, problemSolving: 0, communication: 0 });
  });
});
