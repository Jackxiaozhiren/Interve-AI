/**
 * Analyzer-projection seam (Phase 11, God-component split).
 *
 * Lifted out of the whisper `onmessage` handler in src/app/interview/page.tsx,
 * where two /api/analyze-* `fetch(...).then(data => ...)` chains hand-rolled
 * ~55 lines of store merging inline. The merge rules are the interesting part
 * of this module and were previously unreachable from any test:
 *
 *  - scores are monotonic non-decreasing (Math.max), so a weaker answer never
 *    lowers a live steering number already shown to the candidate;
 *  - STAR time-on-task accumulates while traits do not (per-component sums);
 *  - grounding quotes REPLACE per call, unlike the max-accumulated numbers,
 *    and an envelope with no usable quote leaves the previous quotes alone.
 *
 * One deliberate divergence from the inline code it replaces, pinned by
 * tests/unit/analysis-projection.test.ts: the original guarded only
 * `data.s.progress` and then read `data.t.progress` unguarded, so a 200 body
 * missing a letter threw inside the zustand updater (unhandled rejection; the
 * entire write was lost). Every field here must be a finite number or the
 * component keeps its previous value. Our server cannot produce such a body
 * (StarOutputSchema / BehaviorOutputSchema make the fields required numbers),
 * so the live path is unchanged and a malformed response from a proxy or an
 * error page costs a no-op instead of a crash.
 */
import {
  normalizeGrounding,
  type BehavioralTraits,
  type EvaluatorConfidence,
  type StarComponent,
  type StarProgress,
} from "@/store/useInterveStore";

type Body = Record<string, unknown>;

export interface StarSink {
  setStarProgress: (update: (prev: StarProgress) => StarProgress) => void;
  setStarGrounding: (evidence: string[], confidence: EvaluatorConfidence) => void;
}

export interface TraitsSink {
  setBehavioralTraits: (update: (prev: BehavioralTraits) => BehavioralTraits) => void;
  setTraitsGrounding: (evidence: string[], confidence: EvaluatorConfidence) => void;
}

function asRecord(value: unknown): Body | null {
  return typeof value === "object" && value !== null ? (value as Body) : null;
}

/** A field participates only if it is a real finite number. */
function numOf(body: Body | null, key: string): number | null {
  if (!body) return null;
  const value = body[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

/** max-accumulated score + confidence + time-on-task, or prev when unreadable. */
function mergeComponent(prev: StarComponent, raw: unknown): StarComponent {
  const letter = asRecord(raw);
  const progress = numOf(letter, "progress");
  if (progress === null) return prev;
  return {
    progress: Math.max(prev.progress, progress),
    confidence: numOf(letter, "confidence") ?? 0,
    timeSpentSeconds: prev.timeSpentSeconds + (numOf(letter, "timeSpentSeconds") ?? 0),
  };
}

/**
 * Fold one /api/analyze-star response into the live store.
 * Returns false (and writes nothing) unless Situation reports a finite
 * progress number — the same entry condition the inline `if` enforced.
 */
export function applyStarAnalysis(payload: unknown, sink: StarSink): boolean {
  const body = asRecord(payload);
  if (!body || numOf(asRecord(body.s), "progress") === null) return false;

  sink.setStarProgress((prev) => ({
    s: mergeComponent(prev.s, body.s),
    t: mergeComponent(prev.t, body.t),
    a: mergeComponent(prev.a, body.a),
    r: mergeComponent(prev.r, body.r),
  }));

  const grounding = normalizeGrounding(payload, 4);
  if (grounding.evidence.length > 0) {
    sink.setStarGrounding(grounding.evidence, grounding.confidence);
  }
  return true;
}

/**
 * Fold one /api/analyze-behavior response into the live store. Entry
 * condition mirrors the inline guard: `leadership` must be a number.
 */
export function applyBehavioralAnalysis(payload: unknown, sink: TraitsSink): boolean {
  const body = asRecord(payload);
  const leadership = numOf(body, "leadership");
  if (leadership === null) return false;

  sink.setBehavioralTraits((prev) => ({
    leadership: Math.max(prev.leadership, leadership),
    problemSolving: Math.max(prev.problemSolving, numOf(body, "problemSolving") ?? prev.problemSolving),
    communication: Math.max(prev.communication, numOf(body, "communication") ?? prev.communication),
  }));

  const grounding = normalizeGrounding(payload, 4);
  if (grounding.evidence.length > 0) {
    sink.setTraitsGrounding(grounding.evidence, grounding.confidence);
  }
  return true;
}
