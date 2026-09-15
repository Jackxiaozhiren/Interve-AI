// Phase 8: observable delivery analytics (19.3).
//
// ONLY directly measured quantities: speech rate, filler words, answer
// durations, interruptions (barge-ins), send→response round-trips, STT
// confidence. BANNED packaging lives nowhere here — no anxiety,
// confidence-as-trait, stress, or honesty scores. Averages return null
// (rendered as "—") when nothing was measured, never a guessed number.

export interface DeliverySignals {
  wpm: number;
  fillerWords: number;
  /** Completed answer segments {startMs,endMs}. */
  answerSegments: { startMs: number; endMs: number }[];
  /** Barge-in count (user started speaking over TTS). */
  interruptions: number;
  /** send→first-assistant-message round trips, ms. */
  roundTripsMs: number[];
  sttAvgConfidence: number | null;
  sttFinals: number;
  sttReconnects: number;
}

export interface DeliverySummary {
  wpm: number;
  fillerWords: number;
  /** Mean answer duration, seconds; null when no completed segment. */
  avgAnswerSec: number | null;
  interruptions: number;
  /** Mean send→response round trip, ms; null when unmeasured. */
  avgRoundTripMs: number | null;
  sttAvgConfidence: number | null;
  sttFinals: number;
  sttReconnects: number;
}

function meanOrNull(vals: number[]): number | null {
  const xs = vals.filter((v) => Number.isFinite(v));
  if (xs.length === 0) return null;
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

/** Rounded mean for latency samples (TTFT/whisper/TTS); undefined when empty. */
export function avgLatencyMs(samples: number[]): number | undefined {
  const m = meanOrNull(samples);
  return m === null ? undefined : Math.round(m);
}

export function summarizeDelivery(s: DeliverySignals): DeliverySummary {
  const durations = s.answerSegments
    .map((seg) => (seg.endMs - seg.startMs) / 1000)
    .filter((d) => d > 0);
  const avgSec = meanOrNull(durations);
  const avgRt = meanOrNull(s.roundTripsMs);
  return {
    wpm: s.wpm,
    fillerWords: s.fillerWords,
    avgAnswerSec: avgSec !== null ? Math.round(avgSec * 10) / 10 : null,
    interruptions: s.interruptions,
    avgRoundTripMs: avgRt !== null ? Math.round(avgRt) : null,
    sttAvgConfidence:
      s.sttAvgConfidence !== null ? Math.round(s.sttAvgConfidence * 100) / 100 : null,
    sttFinals: s.sttFinals,
    sttReconnects: s.sttReconnects,
  };
}
