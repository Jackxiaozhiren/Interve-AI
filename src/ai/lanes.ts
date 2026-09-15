// Phase 4: lane classification contract — which AI lanes may produce
// user-facing scores, and under what grounding obligations.
//
// Doctrine (binding): Measured → Evidence → Interpretation.
// - EVIDENCE_GRADED: lanes whose numeric output may be shown to users.
//   Every score MUST carry verbatim evidence + evaluator confidence
//   (confidence = evidence sufficiency, never candidate psychology).
// - STEERING_SIGNALS: live-loop numeric signals (difficulty/follow-up
//   steering). They are rough heuristics, MUST NEVER be displayed as
//   evaluations, and MUST NEVER feed hiring-adjacent UI.
// - ADVISORY: structured text/advice with no user-facing numeric score.
//
// Pinned exhaustively over PROMPT_REGISTRY by lanes.test.ts: adding a new
// prompt without classifying it fails the suite.

/** Numeric output shown to users; evidence + confidence mandatory. */
export const EVIDENCE_GRADED = [
  "evaluation-v2", // analyze-interview: 1-5 anchors + evidence.min(1)
  "analyze-practice", // single-answer drills: score + evidence + confidence
  "analyze-alignment", // setup gap analysis: matchScore + evidence + confidence
  "analyze-match", // resume↔JD match: overallScore + evidence + confidence
] as const;

/** Live-loop steering only. Never displayed as scores. Never hiring input. */
export const STEERING_SIGNALS = [
  "analyze-star", // STAR progress/confidence → follow-up planner + StarTracker
  "analyze-behavior", // trait avgs → loop state (displayed as Experimental only)
  "analyze-chunk", // realtime heuristics; zero consumers; Phase 4+ fate TBD
] as const;
// Steering-envelope note (EVALUATION_V2 §7): all three lanes carry
// evidence[] + evaluator confidence alongside their 0-100 heuristics so
// follow-up/difficulty steering is traceable to transcript quotes. The
// numbers stay quarantined (Experimental, opt-in, never hiring input);
// envelope quotes may surface beside the already-visible experimental
// tiles as grounding, never as new score exposure.

/** Structured advice or pipeline stages; no user-facing numeric score. */
export const ADVISORY = [
  "interview-system", // interview-chat: streaming dialogue, no score
  "analyze-code", // complexity/issues/hints, no single score
  "parse-jd", // question bank generation
  "init-context", // cheatsheet + predictions
  "copilot", // realtime hint strings
  "generate-hint", // single hint string
  "analyze-vision", // diagram feedback string
  "analyze-trends", // cross-session flaws/strengths/plan
  "parse-resume", // OCR text extraction (no prompt id; pipeline stage)
  "interview-coverage", // loop coverage section builder
] as const;

export type LaneClass = "evidence-graded" | "steering-signal" | "advisory";

const ADVISORY_IDS = new Set<string>(ADVISORY as readonly string[]);

export function laneClassOf(promptId: string): LaneClass | null {
  if ((EVIDENCE_GRADED as readonly string[]).includes(promptId)) return "evidence-graded";
  if ((STEERING_SIGNALS as readonly string[]).includes(promptId)) return "steering-signal";
  if (ADVISORY_IDS.has(promptId)) return "advisory";
  return null;
}
