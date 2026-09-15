// Phase 7: progress analytics unit tests (15).
import { describe, it, expect } from "vitest";
import { computeProgressInsights } from "../../src/lib/progress";
import type { Interview } from "../../src/lib/db";

function session(overrides: Partial<Interview> & { createdAt: Date }): Interview {
  return { status: "completed", updatedAt: overrides.createdAt, ...overrides };
}

const DAY = 24 * 3600 * 1000;
const NOW = new Date("2026-09-01T12:00:00Z").getTime();

function v2dims(scores: Record<string, number>) {
  return {
    version: "2.0" as const,
    rubricId: "behavioral-v1",
    readiness: "developing" as const,
    readinessRationale: "r",
    dimensions: Object.entries(scores).map(([id, score]) => ({
      id, score, evidence: ["q"], rationale: "r", confidence: "high" as const, improvement: "i",
    })),
    strengths: [], weaknesses: [], nextDrills: [], qaReview: [],
  };
}

describe("computeProgressInsights", () => {
  it("returns nulls (never invented numbers) on empty input", () => {
    const p = computeProgressInsights([], NOW);
    expect(p.totalCompleted).toBe(0);
    expect(p.starCompletionRate).toBeNull();
    expect(p.technicalDepth).toBeNull();
    expect(p.avgAnswerWords).toBeNull();
    expect(p.improvementVelocity).toBeNull();
    expect(p.typePerformance).toEqual([]);
  });

  it("buckets frequency, types, STAR, depth, conciseness, velocity", () => {
    const sessions = [
      session({
        createdAt: new Date(NOW - 10 * DAY), interviewType: "behavioral",
        evaluationV2: v2dims({ star_completeness: 3, depth: 2 }),
        transcript: [{ id: "1", role: "user", content: "one two three four" }],
      }),
      session({
        createdAt: new Date(NOW - 2 * DAY), interviewType: "behavioral",
        evaluationV2: v2dims({ star_completeness: 4, depth: 4 }),
        transcript: [{ id: "2", role: "user", content: "one two three four five six" }],
      }),
      session({
        createdAt: new Date(NOW - 1 * DAY), interviewType: "coding",
        transcript: [{ id: "3", role: "assistant", content: "ignored interviewer text" }],
      }),
    ];
    const p = computeProgressInsights(sessions, NOW);
    expect(p.totalCompleted).toBe(3);
    expect(p.frequencyLast4Weeks).toEqual([0, 0, 1, 2]);
    expect(p.typePerformance.find((t) => t.type === "behavioral")?.count).toBe(2);
    expect(p.starCompletionRate).toBe(70); // (60+80)/2
    expect(p.technicalDepth).toBe(60); // (40+80)/2
    expect(p.avgAnswerWords).toBe(5); // (4+6)/2, assistant text excluded
    expect(p.improvementVelocity).not.toBeNull();
  });
});
