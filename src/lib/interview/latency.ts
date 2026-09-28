/**
 * One measured interval with a start that can be read more than once.
 *
 * The interview room reports four latencies (submit→first token, submit→end of
 * answer, STT post→transcript, TTS request→first audio). All four are the same
 * shape, and the shape used to be re-typed inline as
 * `if (sendAtRef.current !== null) { samples.push(Date.now() - sendAtRef.current); sendAtRef.current = null }`
 * at each completion site. The interesting part is not the subtraction, it is
 * the two rules encoded here: a completion with no pending start samples
 * nothing (a message that arrives before its own send, or after a reset, is
 * not a measurement), and a span closes exactly once (a duplicate or late
 * worker message cannot inflate the sample list).
 *
 * TTFT and the round trip share one start and are read at different moments,
 * which is why reading (`elapsed`) and consuming (`collectInto`) are separate
 * operations.
 */
export interface LatencySpan {
  /** Begin a span. Calling again before it closes discards the open one. */
  start(at?: number): void;
  /** Duration since the start, or null when nothing is open. Does not close. */
  elapsed(at?: number): number | null;
  /** Close the span, appending the duration to `samples`. Returns null if it was already closed. */
  collectInto(samples: number[], at?: number): number | null;
  /** Abandon an open span, e.g. when the answer is cancelled. */
  reset(): void;
}

export function createLatencySpan(): LatencySpan {
  let startedAt: number | null = null;

  return {
    start(at = Date.now()) {
      startedAt = at;
    },
    elapsed(at = Date.now()) {
      return startedAt === null ? null : at - startedAt;
    },
    collectInto(samples: number[], at = Date.now()) {
      if (startedAt === null) return null;
      const duration = at - startedAt;
      startedAt = null;
      samples.push(duration);
      return duration;
    },
    reset() {
      startedAt = null;
    },
  };
}
