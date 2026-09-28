import { describe, expect, it, vi } from "vitest";
import {
  applyBehavioralAnalysis,
  applyStarAnalysis,
} from "@/lib/interview/analysis-projection";
import type { BehavioralTraits, StarProgress } from "@/store/useInterveStore";

const prevStar: StarProgress = {
  s: { progress: 10, confidence: 50, timeSpentSeconds: 5 },
  t: { progress: 60, confidence: 50, timeSpentSeconds: 7 },
  a: { progress: 0, confidence: 0, timeSpentSeconds: 0 },
  r: { progress: 30, confidence: 50, timeSpentSeconds: 2 },
};

const prevTraits: BehavioralTraits = {
  leadership: 20,
  problemSolving: 80,
  communication: 5,
};

function starSink() {
  return {
    setStarProgress: vi.fn(),
    setStarGrounding: vi.fn(),
  };
}

function traitsSink() {
  return {
    setBehavioralTraits: vi.fn(),
    setTraitsGrounding: vi.fn(),
  };
}

/** The shape /api/analyze-star returns on 200: okResponse(object) puts the
 *  zod-validated fields at the top level (src/lib/api/errors.ts:39). */
const validStar = {
  s: { progress: 40, confidence: 70, timeSpentSeconds: 12 },
  t: { progress: 55, confidence: 60, timeSpentSeconds: 3 },
  a: { progress: 88, confidence: 40, timeSpentSeconds: 20 },
  r: { progress: 12, confidence: 90, timeSpentSeconds: 1 },
  evidence: ["quote one", "quote two"],
  confidence: "high",
};

const validBehavior = {
  leadership: 55,
  problemSolving: 40,
  communication: 91,
  evidence: ["she owned the migration"],
  confidence: "low",
};

/** errorResponse() envelope — the shape every failed analyzer call returns. */
const errorEnvelope = {
  error: { code: "UPSTREAM_ERROR", message: "Failed to analyze STAR progress" },
  requestId: "req_1",
};

function appliedProgress(sink: ReturnType<typeof starSink>): StarProgress {
  const updater = sink.setStarProgress.mock.calls[0][0] as (
    prev: StarProgress
  ) => StarProgress;
  return updater(prevStar);
}

describe("STAR projection (extracted from the interview God component)", () => {
  it("keeps progress monotonic and accumulates time per component", () => {
    const sink = starSink();
    expect(applyStarAnalysis(validStar, sink)).toBe(true);
    const next = appliedProgress(sink);
    // Math.max on progress only: t's 55 cannot lower the stored 60, but its
    // confidence and time-on-task still come from the fresh payload.
    expect(next).toEqual({
      s: { progress: 40, confidence: 70, timeSpentSeconds: 17 },
      t: { progress: 60, confidence: 60, timeSpentSeconds: 10 },
      a: { progress: 88, confidence: 40, timeSpentSeconds: 20 },
      r: { progress: 30, confidence: 90, timeSpentSeconds: 3 },
    });
  });

  it("replaces the steering quotes with the latest evidence", () => {
    const sink = starSink();
    applyStarAnalysis(validStar, sink);
    expect(sink.setStarGrounding).toHaveBeenCalledWith(["quote one", "quote two"], "high");
  });

  it("writes nothing at all for an error envelope", () => {
    // This is the guard's job: res.json() resolves happily on 500, so without
    // it the store would receive undefined where a letter is expected.
    const sink = starSink();
    expect(applyStarAnalysis(errorEnvelope, sink)).toBe(false);
    expect(sink.setStarProgress).not.toHaveBeenCalled();
    expect(sink.setStarGrounding).not.toHaveBeenCalled();
  });

  it("still records progress when the envelope carries no usable quotes", () => {
    const sink = starSink();
    const noQuotes = { ...validStar, evidence: [] };
    expect(applyStarAnalysis(noQuotes, sink)).toBe(true);
    expect(sink.setStarProgress).toHaveBeenCalled();
    expect(sink.setStarGrounding).not.toHaveBeenCalled();
  });

  it("degrades an out-of-enum confidence to medium", () => {
    const sink = starSink();
    applyStarAnalysis({ ...validStar, confidence: "very sure indeed" }, sink);
    expect(sink.setStarGrounding).toHaveBeenCalledWith(expect.any(Array), "medium");
  });

  it("caps quotes at four and drops non-strings", () => {
    const sink = starSink();
    applyStarAnalysis(
      { ...validStar, evidence: ["a", "b", "c", "d", "e", 7, null] },
      sink
    );
    expect(sink.setStarGrounding).toHaveBeenCalledWith(["a", "b", "c", "d"], "high");
  });

  it("tolerates a payload missing the letters the entry guard never checked", () => {
    // DEVIATION from the inline code this was lifted out of, by design. The
    // original read data.t.progress after guarding only data.s.progress, so a
    // partial 200 body threw inside the zustand updater (an unhandled
    // rejection that dropped the whole write). Unreachable from our server —
    // StarOutputSchema makes all four required — so the live path is
    // unchanged, and a hostile proxy now costs nothing.
    const sink = starSink();
    const partial = { s: { progress: 40, confidence: 70, timeSpentSeconds: 12 } };
    expect(applyStarAnalysis(partial, sink)).toBe(true);
    const next = appliedProgress(sink);
    expect(next.s.progress).toBe(40);
    expect(next.t).toEqual(prevStar.t);
    expect(next.r).toEqual(prevStar.r);
  });
});

describe("behavioral projection", () => {
  it("keeps each trait monotonic non-decreasing", () => {
    const sink = traitsSink();
    expect(applyBehavioralAnalysis(validBehavior, sink)).toBe(true);
    const updater = sink.setBehavioralTraits.mock.calls[0][0] as (
      prev: BehavioralTraits
    ) => BehavioralTraits;
    expect(updater(prevTraits)).toEqual({
      leadership: 55,
      problemSolving: 80,
      communication: 91,
    });
  });

  it("writes grounding separately from scores, as the inline code did", () => {
    const sink = traitsSink();
    applyBehavioralAnalysis(validBehavior, sink);
    expect(sink.setTraitsGrounding).toHaveBeenCalledWith(["she owned the migration"], "low");
  });

  it("rejects an error envelope before touching the store", () => {
    const sink = traitsSink();
    expect(applyBehavioralAnalysis(errorEnvelope, sink)).toBe(false);
    expect(sink.setBehavioralTraits).not.toHaveBeenCalled();
    expect(sink.setTraitsGrounding).not.toHaveBeenCalled();
  });
});
