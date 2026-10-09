/**
 * The dashboard's readiness headline, as one pure function.
 *
 * This computation used to live inline in `src/app/dashboard/page.tsx` as
 * `completedSessions.reduce((acc, s) => acc + (sessionScore(s) ?? 0), 0) / length`.
 * The `?? 0` is what made it wrong: a completed session with nothing renderable
 * contributed a zero, so the card read "Average Score 40/100" for a candidate who
 * had one good session and one whose evaluation never landed. `src/lib/progress.ts`
 * — rendered on the same page — filters unscored sessions out before averaging, so
 * the headline and the panel were computing the same word differently.
 *
 * The rule here is the one `progress.ts` already applies, with the denominator
 * surfaced rather than implied: average over scored sessions, say how many that
 * was out of how many completed, and keep `null` where there is nothing to
 * average. An absent number is reported as absent; 0 is reserved for a candidate
 * who scored zero, which the rubric anchors make impossible anyway (the lowest
 * anchor renders as 20/100).
 */
import { sessionScore } from "./eval-compat";
import type { Interview } from "./db";

export interface ReadinessTrendPoint {
  /** "Session 1", oldest first — the label the chart's x-axis shows. */
  name: string;
  /** null when the session has no renderable evaluation; the chart gaps on it. */
  score: number | null;
  sessionId: string;
}

export interface ReadinessSummary {
  /** Mean of the scored sessions, or null when none of them is scored. */
  average: number | null;
  /** Sessions that contributed to `average`. */
  scoredCount: number;
  /** Completed sessions, scored or not — the denominator `scoredCount` is out of. */
  totalCount: number;
  trend: ReadinessTrendPoint[];
}

function byCreatedAtAsc(a: Interview, b: Interview): number {
  return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
}

export function summarizeReadiness(sessions: Interview[]): ReadinessSummary {
  const completed = sessions.filter((s) => s.status === "completed");
  // The trend is chronological; the card does not care about order, but one
  // sort keeps the two readings of "my sessions" from diverging.
  const ordered = [...completed].sort(byCreatedAtAsc);

  const scored = ordered
    .map((s) => sessionScore(s))
    .filter((v): v is number => v !== null);

  const average = scored.length > 0 ? Math.round(scored.reduce((a, b) => a + b, 0) / scored.length) : null;

  return {
    average,
    scoredCount: scored.length,
    totalCount: completed.length,
    trend: ordered.map((s, i) => ({
      name: `Session ${i + 1}`,
      score: sessionScore(s),
      sessionId: String(s.id),
    })),
  };
}

export interface RadarAxis {
  subject: string;
  A: number;
  B?: number;
}

/**
 * The skill-breakdown card's axes, measured-only.
 *
 * Same rule as `summarizeReadiness` above, applied to the chart that used to
 * `?? 0` every absent axis: an axis nobody scored is left out, a score of 0
 * stays in (0 is a measurement), and the "First Session" series appears only when
 * the first session has a number for every axis being shown. Partial comparison is
 * not salvageable per axis — one invented baseline point drags the whole legend
 * into fiction, so the series is dropped and the card says "Latest session".
 */
export function radarSeries(
  latest: Record<string, number | null | undefined> | null | undefined,
  first: Record<string, number | null | undefined> | null | undefined,
  subjects: readonly { id: string; name: string }[]
): { axes: RadarAxis[]; comparable: boolean } {
  const measured = subjects
    .map((s) => ({ id: s.id, subject: s.name, A: latest?.[s.id] }))
    .filter((e): e is { id: string; subject: string; A: number } => typeof e.A === "number");

  if (measured.length === 0) return { axes: [], comparable: false };

  const paired = measured
    .map((e) => ({ subject: e.subject, A: e.A, B: first?.[e.id] }))
    .filter((e): e is { subject: string; A: number; B: number } => typeof e.B === "number");

  // The comparison holds only if *every* shown axis has a first-session number.
  const comparable = paired.length === measured.length;
  return {
    axes: comparable ? paired : measured.map((e) => ({ subject: e.subject, A: e.A })),
    comparable,
  };
}
