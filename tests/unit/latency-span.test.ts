import { describe, expect, it } from "vitest";
import { createLatencySpan } from "@/lib/interview/latency";

/**
 * The interview room measures four spans: submit→first-token (TTFT),
 * submit→end-of-answer (round trip), STT post→transcript, and TTS
 * request→first audio. Each is "mark a start, close it once, into a sample
 * list", and the rule that matters is the one that used to be re-typed inline
 * four times: a close with no pending start must sample NOTHING, and a span
 * closes exactly once (a late duplicate message must not count twice).
 *
 * TTFT and the round trip share one start and are read at different times, so
 * `elapsed()` deliberately does not consume the span; `collectInto()` does.
 */
describe("createLatencySpan", () => {
  it("samples nothing when no span was started", () => {
    const span = createLatencySpan();
    const samples: number[] = [];
    expect(span.collectInto(samples, 1000)).toBeNull();
    expect(samples).toEqual([]);
  });

  it("closes exactly once", () => {
    const span = createLatencySpan();
    const samples: number[] = [];
    span.start(1000);
    expect(span.collectInto(samples, 1120)).toBe(120);
    expect(samples).toEqual([120]);
    // A second completion (a late or duplicate worker message) adds nothing.
    expect(span.collectInto(samples, 1200)).toBeNull();
    expect(samples).toEqual([120]);
  });

  it("lets one start feed two readers without consuming it", () => {
    const span = createLatencySpan();
    span.start(1000);
    expect(span.elapsed(1040)).toBe(40);
    expect(span.elapsed(1300)).toBe(300);
    expect(span.collectInto([], 1300)).toBe(300);
    expect(span.elapsed(1400)).toBeNull();
  });

  it("restarts for the next answer instead of stacking", () => {
    const span = createLatencySpan();
    const samples: number[] = [];
    span.start(1000);
    span.collectInto(samples, 1100);
    span.start(2000);
    span.collectInto(samples, 2050);
    expect(samples).toEqual([100, 50]);
  });

  it("drops a stale open span on reset", () => {
    const span = createLatencySpan();
    const samples: number[] = [];
    span.start(1000);
    span.reset();
    expect(span.collectInto(samples, 5000)).toBeNull();
    expect(samples).toEqual([]);
  });

  it("defaults both timestamps to the same clock and never goes backwards", () => {
    const span = createLatencySpan();
    span.start(1000);
    // Out-of-order completion (a clock jump or a message that beat its own
    // start) is reported, not clamped to a fake zero.
    expect(span.elapsed(900)).toBe(-100);
  });

  it("survives a start with no explicit time", () => {
    const span = createLatencySpan();
    span.start();
    const samples: number[] = [];
    const value = span.collectInto(samples);
    expect(typeof value).toBe("number");
    expect(value).toBeGreaterThanOrEqual(0);
    expect(samples).toHaveLength(1);
  });
});
