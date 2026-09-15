// Phase 6: structured interview loop state (Interview Memory).
//
// The interviewer LLM no longer flies blind on a frozen context snapshot:
// every turn carries a compact, versioned state (turns, coverage gaps,
// difficulty, time budget) synthesized from REAL signals — message history,
// timers, and the existing STAR/behavioral analyzer outputs. Analyzer
// snapshots may lag one turn (they resolve asynchronously); this is
// documented in prompts as "experimental estimates".
//
// All functions are pure (except Date.now defaults) and unit-tested.
// The server re-derives authority-side fields from `messages`, so clients
// can only nudge difficulty ±1 per turn, never dictate it.

export const INTERVIEW_STATE_VERSION = "1.0.0";

export const DIFFICULTIES = ["easy", "medium", "hard", "expert"] as const;
export type Difficulty = (typeof DIFFICULTIES)[number];

export const DEFAULT_TIME_BUDGET_SEC = 900; // 15 minutes

export interface StarSnapshot {
  s: { progress: number };
  t: { progress: number };
  a: { progress: number };
  r: { progress: number };
}

/** Full analyzer echo (progress + confidence + timing), sanitized server-side. */
export interface StarSnapshotFull {
  s: { progress: number; confidence: number; timeSpentSeconds: number };
  t: { progress: number; confidence: number; timeSpentSeconds: number };
  a: { progress: number; confidence: number; timeSpentSeconds: number };
  r: { progress: number; confidence: number; timeSpentSeconds: number };
}

export interface TraitsSnapshot {
  leadership: number;
  problemSolving: number;
  communication: number;
}

export interface TurnRecord {
  turn: number;
  /** Assistant question that prompted this turn (excerpt). */
  question: string;
}

export interface InterviewState {
  version: typeof INTERVIEW_STATE_VERSION;
  difficulty: Difficulty;
  turnCount: number;
  startedAt: number;
  timeBudgetSec: number;
  questionHistory: TurnRecord[];
  starAvg: number | null;
  traitsAvg: number | null;
  followUpTargets: string[];
}

/** Seniority → starting difficulty (documented default, adapts after). */
export function levelToDifficulty(level?: string): Difficulty {
  const l = (level || "").toLowerCase();
  if (l.includes("intern") || l.includes("junior")) return "easy";
  if (l.includes("senior") || l.includes("staff") || l.includes("principal") || l.includes("lead")) return "hard";
  return "medium";
}

function mean(vals: number[]): number | null {
  if (vals.length === 0) return null;
  return vals.reduce((a, b) => a + b, 0) / vals.length;
}

/**
 * Snapshot sanitizer (Phase 6 hardening): analyzer snapshots arrive from
 * the client (echoes of analyze-star/behavior outputs). Forged or corrupt
 * values previously flowed straight into difficulty math ("STAR avg NaN/100"
 * in prompts) and follow-up labels. Clamp to finite 0-100; anything else
 * becomes null (unknown), which the loop already handles as hold/advance.
 * Residual: a client can still forge in-range values — but that only
 * mis-steers its own training session (no cross-user effect).
 */
function clampSignal(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? Math.min(100, Math.max(0, v)) : null;
}

export function sanitizeStarSnapshot(sp: unknown): StarSnapshotFull | null {
  if (typeof sp !== "object" || sp === null) return null;
  const o = sp as Record<string, unknown>;
  let seen = false;
  const pick = (k: string): { progress: number; confidence: number; timeSpentSeconds: number } => {
    const c = (typeof o[k] === "object" && o[k] !== null ? o[k] : {}) as Record<string, unknown>;
    const progress = clampSignal(c.progress);
    const confidence = clampSignal(c.confidence);
    const timeSpentSeconds = typeof c.timeSpentSeconds === "number" && Number.isFinite(c.timeSpentSeconds)
      ? Math.min(3600, Math.max(0, c.timeSpentSeconds))
      : 0;
    if (progress !== null || confidence !== null) seen = true;
    return { progress: progress ?? 0, confidence: confidence ?? 0, timeSpentSeconds };
  };
  const out = { s: pick("s"), t: pick("t"), a: pick("a"), r: pick("r") };
  return seen ? out : null;
}

export function sanitizeTraitsSnapshot(tr: unknown): TraitsSnapshot | null {
  if (typeof tr !== "object" || tr === null) return null;
  const o = tr as Record<string, unknown>;
  const leadership = clampSignal(o.leadership);
  const problemSolving = clampSignal(o.problemSolving);
  const communication = clampSignal(o.communication);
  if (leadership === null && problemSolving === null && communication === null) return null;
  return {
    leadership: leadership ?? 0,
    problemSolving: problemSolving ?? 0,
    communication: communication ?? 0,
  };
}

export function starAverage(sp?: StarSnapshot | null): number | null {
  if (!sp) return null;
  return mean([sp.s.progress, sp.t.progress, sp.a.progress, sp.r.progress]);
}

export function traitsAverage(tr?: TraitsSnapshot | null): number | null {
  if (!tr) return null;
  return mean([tr.leadership, tr.problemSolving, tr.communication]);
}

const STAR_LABELS: [keyof StarSnapshot, string][] = [
  ["s", "STAR-Situation"],
  ["t", "STAR-Task"],
  ["a", "STAR-Action"],
  ["r", "STAR-Result"],
];

const TRAIT_LABELS: [keyof TraitsSnapshot, string][] = [
  ["leadership", "Leadership"],
  ["problemSolving", "Problem Solving"],
  ["communication", "Communication"],
];

/**
 * Follow-up planner (deterministic): thin STAR components (<50) and weak
 * traits (<40) become explicit, prioritized probe targets — the same
 * thresholds the interviewer UI already used, now as transparent state
 * instead of stealth instructions.
 */
export function deriveFollowUpTargets(
  starProgress?: StarSnapshot | null,
  behavioralTraits?: TraitsSnapshot | null
): string[] {
  const targets: string[] = [];
  if (starProgress) {
    for (const [key, label] of STAR_LABELS) {
      const v = starProgress[key]?.progress;
      if (typeof v === "number" && v < 50) targets.push(`${label} thin (${Math.round(v)}%)`);
    }
  }
  if (behavioralTraits) {
    for (const [key, label] of TRAIT_LABELS) {
      const v = behavioralTraits[key];
      if (typeof v === "number" && v < 40) targets.push(`${label} weak (${Math.round(v)})`);
    }
  }
  return targets.slice(0, 5);
}

/**
 * Difficulty adaptation (documented rules, tested):
 * - fewer than 2 turns: hold (insufficient evidence);
 * - no signals: hold;
 * - combined mean >= 75: step up (cap expert);
 * - combined mean < 40: step down (floor easy);
 * - else hold. At most one step per call.
 */
export function adaptDifficulty(
  current: Difficulty,
  signals: { starAvg: number | null; traitsAvg: number | null; turnCount: number }
): Difficulty {
  const idx = DIFFICULTIES.indexOf(current);
  const base = idx >= 0 ? idx : 1;
  if (signals.turnCount < 2) return DIFFICULTIES[base];
  const vals = [signals.starAvg, signals.traitsAvg].filter((v): v is number => typeof v === "number");
  if (vals.length === 0) return DIFFICULTIES[base];
  const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
  if (avg >= 75) return DIFFICULTIES[Math.min(DIFFICULTIES.length - 1, base + 1)];
  if (avg < 40) return DIFFICULTIES[Math.max(0, base - 1)];
  return DIFFICULTIES[base];
}

export function initInterviewState(opts?: { level?: string; timeBudgetSec?: number; now?: number }): InterviewState {
  return {
    version: INTERVIEW_STATE_VERSION,
    difficulty: levelToDifficulty(opts?.level),
    turnCount: 0,
    startedAt: opts?.now ?? Date.now(),
    timeBudgetSec: opts?.timeBudgetSec ?? DEFAULT_TIME_BUDGET_SEC,
    questionHistory: [],
    starAvg: null,
    traitsAvg: null,
    followUpTargets: [],
  };
}

export function recordTurn(
  state: InterviewState,
  turn: {
    question: string;
    starProgress?: StarSnapshot | null | unknown;
    behavioralTraits?: TraitsSnapshot | null | unknown;
  }
): InterviewState {
  const turnCount = state.turnCount + 1;
  // Same sanitizer as the server synthesis (Phase 6): analyzer snapshots
  // are client-echoed and may be corrupt; never let them poison loop math.
  const star = sanitizeStarSnapshot(turn.starProgress ?? null);
  const traits = sanitizeTraitsSnapshot(turn.behavioralTraits ?? null);
  const starAvg = starAverage(star);
  const traitsAvg = traitsAverage(traits);
  const history = [...state.questionHistory, { turn: turnCount, question: turn.question.slice(0, 500) }].slice(-50);
  return {
    ...state,
    turnCount,
    questionHistory: history,
    starAvg: starAvg ?? state.starAvg,
    traitsAvg: traitsAvg ?? state.traitsAvg,
    followUpTargets: deriveFollowUpTargets(star, traits),
    difficulty: adaptDifficulty(state.difficulty, {
      starAvg: starAvg ?? state.starAvg,
      traitsAvg: traitsAvg ?? state.traitsAvg,
      turnCount,
    }),
  };
}

export function remainingSec(state: Pick<InterviewState, "startedAt" | "timeBudgetSec">, now = Date.now()): number {
  return Math.max(0, state.timeBudgetSec - Math.floor((now - state.startedAt) / 1000));
}

export interface ServerMessage {
  role?: unknown;
  content?: unknown;
  parts?: unknown;
  text?: unknown;
}

function messageText(m: ServerMessage): string {
  if (typeof m.content === "string") return m.content;
  if (typeof m.text === "string") return m.text;
  if (Array.isArray(m.parts)) {
    const t = m.parts
      .filter((p): p is { type: string; text?: unknown } => typeof p === "object" && p !== null)
      .filter((p) => p.type === "text" && typeof p.text === "string")
      .map((p) => p.text as string)
      .join(" ");
    if (t) return t;
  }
  return "";
}

/**
 * Server-side synthesis: authority-side state derived from the actual
 * message history + current analyzer snapshots. `difficultyHint` (client)
 * is honored only as the ±1 adaptation base; unknown values fall back to
 * the seniority default. This keeps clients honest without trusting them.
 */
export function synthesizeServerState(opts: {
  messages: ServerMessage[];
  level?: string;
  starProgress?: StarSnapshot | null;
  behavioralTraits?: TraitsSnapshot | null;
  startedAt?: number;
  timeBudgetSec?: number;
  difficultyHint?: string;
}): InterviewState {
  const turns = opts.messages.filter((m) => m.role === "user").length;
  const questions = opts.messages
    .filter((m) => m.role === "assistant")
    .map((m) => messageText(m).slice(0, 300))
    .filter((t) => t.length > 0)
    .slice(-50);
  const base: Difficulty = DIFFICULTIES.includes(opts.difficultyHint as Difficulty)
    ? (opts.difficultyHint as Difficulty)
    : levelToDifficulty(opts.level);
  // Sanitize client-echoed snapshots (Phase 6): forged/corrupt values must
  // not poison difficulty math or follow-up labels. startedAt from the
  // future (clock skew or tampering) would stretch the budget forever.
  const starProgress = sanitizeStarSnapshot(opts.starProgress);
  const behavioralTraits = sanitizeTraitsSnapshot(opts.behavioralTraits);
  const starAvg = starAverage(starProgress);
  const traitsAvg = traitsAverage(behavioralTraits);
  const now = Date.now();
  const startedAt =
    typeof opts.startedAt === "number" && opts.startedAt > 0 ? Math.min(opts.startedAt, now) : now;
  return {
    version: INTERVIEW_STATE_VERSION,
    difficulty: adaptDifficulty(base, { starAvg, traitsAvg, turnCount: turns }),
    turnCount: turns,
    startedAt,
    timeBudgetSec: opts.timeBudgetSec ?? DEFAULT_TIME_BUDGET_SEC,
    questionHistory: questions.map((question, i) => ({ turn: i + 1, question })),
    starAvg,
    traitsAvg,
    followUpTargets: deriveFollowUpTargets(starProgress, behavioralTraits),
  };
}
