/**
 * The dashboard's headline score: which sessions own the denominator.
 *
 * `src/app/dashboard/page.tsx` averaged `sessionScore(s) ?? 0` over *every*
 * completed session, while `src/lib/progress.ts` — the module this page also
 * renders beside it — filters unscored sessions out before averaging its own
 * numbers. Same product, same field, two rules: an unevaluated session counted
 * as a zero on the headline card and as absent in the insights panel, so the two
 * could not both be describing the candidate's readiness.
 *
 * A completed-but-unscored session is not hypothetical. `sessionScore` returns
 * null whenever `toEvaluationView` finds no dimensions it can read — a historical
 * row whose `radarScores` is missing the later-added axes (bodyLanguage, pressure,
 * systemDesign were introduced over time) yields `dimensions: []` and therefore
 * null — and a row whose evaluation never landed has no `evaluationV2` either.
 *
 * These tests pin the fixed rule: average over scored sessions only, name that
 * count next to the number, keep the null in the trend so the chart shows a gap
 * rather than a collapse, and report *no* average rather than 0 when nothing has
 * been scored.
 */
import { describe, expect, it } from "vitest";
import { summarizeReadiness } from "@/lib/dashboard-stats";
import { computeProgressInsights } from "@/lib/progress";
import { sessionScore } from "@/lib/eval-compat";
import type { Interview } from "@/lib/db";

const DAY = 24 * 3600 * 1000;
const NOW = new Date("2026-09-01T12:00:00Z").getTime();

function session(overrides: Partial<Interview> & { createdAt: Date }): Interview {
  return { status: "completed", updatedAt: overrides.createdAt, ...overrides };
}

function v2dims(scores: Record<string, number>): Interview["evaluationV2"] {
  return {
    version: "2.0",
    rubricId: "behavioral-v1",
    readiness: "developing",
    readinessRationale: "r",
    dimensions: Object.entries(scores).map(([id, score]) => ({
      id,
      score,
      evidence: ["q"],
      rationale: "r",
      confidence: "high" as const,
      improvement: "i",
    })),
    strengths: [],
    weaknesses: [],
    nextDrills: [],
    qaReview: [],
  };
}

describe("the readiness headline counts only scored sessions", () => {
  it("drops an unscored session instead of scoring it zero", () => {
    const sessions = [
      session({ createdAt: new Date(NOW - 3 * DAY), evaluationV2: v2dims({ clarity: 4 }) }),
      // Completed, but nothing renderable: no evaluationV2, no radar axes.
      session({ createdAt: new Date(NOW - 2 * DAY), hireVerdict: "leaning_hire" }),
    ];
    expect(sessionScore(sessions[1]!), "premise: this row has no score").toBeNull();

    const summary = summarizeReadiness(sessions);
    expect(summary.totalCount).toBe(2);
    expect(summary.scoredCount).toBe(1);
    expect(summary.average).toBe(80);
  });

  it("says there is no average rather than reporting 0 when nothing is scored", () => {
    const summary = summarizeReadiness([
      session({ createdAt: new Date(NOW - DAY), hireVerdict: "hire" }),
    ]);
    expect(summary.average).toBeNull();
    expect(summary.scoredCount).toBe(0);
  });

  it("treats a row the adapter itself cannot score as unscored", () => {
    // `Interview.radarScores` requires every axis, so a *partially* written legacy
    // row is not the reachable shape. The reachable one is the branch
    // `toEvaluationView` spells out: an `evaluationV2` with no dimensions, which
    // falls through to legacy, which finds no radar, and yields `average: null`.
    // `status: 'completed'` is written by the settlement path together with a
    // schema-validated `evaluationV2`, so this is the shape of an older or
    // half-written row, not of a session completed today — and the headline still
    // has to say "no data" rather than "zero" when it meets one.
    const scored = session({ createdAt: new Date(NOW - 5 * DAY), evaluationV2: v2dims({ clarity: 4 }) });
    expect(sessionScore(scored)).toBe(80);
    const hollow = session({ createdAt: new Date(NOW - 4 * DAY), evaluationV2: v2dims({}) });
    expect(sessionScore(hollow), "premise: dimensions: [] is the adapter's own null path").toBeNull();

    const summary = summarizeReadiness([scored, hollow]);
    expect(summary.average).toBe(80);
    expect(summary.scoredCount).toBe(1);
    expect(summary.totalCount).toBe(2);
  });

  it("agrees with the insights panel sitting next to it", () => {
    const sessions = [
      session({ createdAt: new Date(NOW - 6 * DAY), interviewType: "behavioral", evaluationV2: v2dims({ clarity: 5 }) }),
      session({ createdAt: new Date(NOW - 5 * DAY), interviewType: "behavioral", evaluationV2: v2dims({ clarity: 3 }) }),
      session({ createdAt: new Date(NOW - 4 * DAY), interviewType: "behavioral", hireVerdict: "hire" }),
    ];
    const summary = summarizeReadiness(sessions);
    const insights = computeProgressInsights(sessions, NOW);
    const behavioral = insights.typePerformance.find((t) => t.type === "behavioral");
    expect(behavioral?.average, "the insights panel must have the same set to average").toBe(80);
    expect(summary.average).toBe(behavioral?.average);
  });

  it("ignores sessions that never completed", () => {
    const summary = summarizeReadiness([
      session({ createdAt: new Date(NOW - DAY), evaluationV2: v2dims({ clarity: 4 }) }),
      session({ createdAt: new Date(NOW - 2 * DAY), status: "in_progress", evaluationV2: v2dims({ clarity: 1 }) }),
    ]);
    expect(summary.totalCount).toBe(1);
    expect(summary.average).toBe(80);
  });

  it("keeps the null in the trend so the chart can show a gap, not a collapse", () => {
    const summary = summarizeReadiness([
      session({ createdAt: new Date(NOW - 2 * DAY), evaluationV2: v2dims({ clarity: 4 }) }),
      session({ createdAt: new Date(NOW - DAY), hireVerdict: "hire" }),
    ]);
    expect(summary.trend.map((p) => p.score)).toEqual([80, null]);
    expect(summary.trend[1]!.sessionId, "the click-through must still work for an unscored session").toBeDefined();
  });

  // No "does not mutate the caller's array" case here. An earlier draft had one,
  // and the plant battery proved it could not fail: `sessions.filter(...)` already
  // returns a new array, so sorting the result can never reorder the caller's. An
  // assertion that is guaranteed by the standard library is decoration, not a check.
  it("orders the trend oldest first", () => {
    const input = [
      session({ createdAt: new Date(NOW - DAY), evaluationV2: v2dims({ clarity: 2 }) }),
      session({ createdAt: new Date(NOW - 9 * DAY), evaluationV2: v2dims({ clarity: 4 }) }),
    ];
    const summary = summarizeReadiness(input);
    expect(summary.trend.map((p) => p.score)).toEqual([80, 40]);
  });

  it("returns an empty summary rather than throwing on no sessions", () => {
    expect(summarizeReadiness([])).toEqual({
      average: null,
      scoredCount: 0,
      totalCount: 0,
      trend: [],
    });
  });
});
