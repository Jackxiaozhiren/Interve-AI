// Phase 7: progress analytics over sessions (15). Pure functions over
// minimal session shapes — no DB access, fully unit-tested.
import { sessionScore } from "./eval-compat";
import type { Interview } from "./db";

export interface TypePerformance {
  type: string;
  count: number;
  average: number | null;
}

export interface ProgressInsights {
  totalCompleted: number;
  /** Completed sessions per week, oldest → newest, last 4 weeks. */
  frequencyLast4Weeks: number[];
  typePerformance: TypePerformance[];
  /** Mean STAR-completeness (V2 behavioral) or null when unevaluated. */
  starCompletionRate: number | null;
  /** Mean of depth-family dimensions (V2) or null. */
  technicalDepth: number | null;
  /** Mean user-answer word count across transcripts (observable). */
  avgAnswerWords: number | null;
  /** Second-half minus first-half session-score average (needs ≥2 scored). */
  improvementVelocity: number | null;
}

const DEPTH_DIM_IDS = new Set(["depth", "correctness", "modeling", "architecture", "framing"]);

function words(s: string): number {
  const n = s.trim().split(/\s+/).filter(Boolean).length;
  return Number.isFinite(n) ? n : 0;
}

export function computeProgressInsights(sessions: Interview[], now = Date.now()): ProgressInsights {
  const completed = sessions
    .filter((s) => s.status === "completed")
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

  const scored = completed
    .map((s) => ({ s, score: sessionScore(s) }))
    .filter((x): x is { s: Interview; score: number } => x.score !== null);

  // Frequency: 4 weekly buckets ending now.
  const week = 7 * 24 * 3600 * 1000;
  const frequencyLast4Weeks = [3, 2, 1, 0].map((wAgo) => {
    const start = now - (wAgo + 1) * week;
    const end = now - wAgo * week;
    return completed.filter((s) => {
      const t = new Date(s.createdAt).getTime();
      return t >= start && t < end;
    }).length;
  });

  // Type performance.
  const byType = new Map<string, number[]>();
  for (const { s, score } of scored) {
    const t = s.interviewType || "general";
    if (!byType.has(t)) byType.set(t, []);
    byType.get(t)!.push(score);
  }
  const typePerformance: TypePerformance[] = [...byType.entries()].map(([type, scores]) => ({
    type,
    count: scores.length,
    average: Math.round(scores.reduce((a, b) => a + b, 0) / scores.length),
  }));

  // STAR completion + technical depth from V2 dimensions.
  const starVals: number[] = [];
  const depthVals: number[] = [];
  for (const s of completed) {
    const dims = s.evaluationV2?.dimensions;
    if (!dims) continue;
    for (const d of dims) {
      if (d.id === "star_completeness") starVals.push(d.score * 20);
      if (DEPTH_DIM_IDS.has(d.id)) depthVals.push(d.score * 20);
    }
  }
  const meanOrNull = (v: number[]) => (v.length > 0 ? Math.round(v.reduce((a, b) => a + b, 0) / v.length) : null);

  // Conciseness from transcripts.
  const answerLens: number[] = [];
  for (const s of completed) {
    for (const m of s.transcript ?? []) {
      if (m.role === "user" && m.content) answerLens.push(words(m.content));
    }
  }

  // Velocity: second-half mean minus first-half mean.
  let improvementVelocity: number | null = null;
  if (scored.length >= 2) {
    const half = Math.floor(scored.length / 2);
    const first = scored.slice(0, half);
    const second = scored.slice(half);
    const mean = (xs: { score: number }[]) => xs.reduce((a, x) => a + x.score, 0) / xs.length;
    improvementVelocity = Math.round(mean(second) - mean(first));
  }

  return {
    totalCompleted: completed.length,
    frequencyLast4Weeks,
    typePerformance,
    starCompletionRate: meanOrNull(starVals),
    technicalDepth: meanOrNull(depthVals),
    avgAnswerWords: answerLens.length > 0 ? Math.round(answerLens.reduce((a, b) => a + b, 0) / answerLens.length) : null,
    improvementVelocity,
  };
}
