// Shared evidence-envelope fields for grounded lanes (EVALUATION_V2 §7).
//
// EVIDENCE_GRADED lanes (practice, alignment, match) and STEERING_SIGNAL
// lanes (star, behavior, chunk) carry the same grounding obligation:
// verbatim quotes + evaluator confidence (evidence sufficiency, never
// candidate psychology). Defining the Zod fragments once prevents the six
// schemas from drifting apart (different caps, different confidence enums).
// Per-lane max counts and describe text stay at the call site on purpose:
// field descriptions are sent to the model, so unifying the prose would be
// a prompt change requiring keyed regression.
import { z } from "zod";

/** Verbatim-quote evidence array with a per-lane cap. Call site owns `describe`. */
export function evidenceField(maxItems: number, describe: string) {
  return z.array(z.string().max(500)).max(maxItems).default([]).describe(describe);
}

/** Evaluator confidence = evidence sufficiency, never candidate psychology. */
export function confidenceField(describe: string) {
  return z.enum(["high", "medium", "low"]).default("medium").describe(describe);
}

export type GroundingConfidence = "high" | "medium" | "low";

/**
 * Client-safe grounding normalizer (no zod import at runtime, never throws).
 * Filters non-strings/empties, caps to `max`, enum-falls-back-to-medium.
 * Shared by the interview store, practice attempts, and the
 * alignment→matchData adaptation so all three surfaces drift together.
 */
export function normalizeGrounding(
  evidence: unknown,
  confidence: unknown,
  max = 6,
): { evidence: string[]; confidence: GroundingConfidence } {
  try {
    const quotes = Array.isArray(evidence)
      ? evidence.filter((q): q is string => typeof q === "string" && q.trim().length > 0).slice(0, max)
      : [];
    const conf: GroundingConfidence =
      confidence === "high" || confidence === "medium" || confidence === "low"
        ? confidence
        : "medium";
    return { evidence: quotes, confidence: conf };
  } catch {
    return { evidence: [], confidence: "medium" };
  }
}
