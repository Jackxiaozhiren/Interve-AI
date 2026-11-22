"use client";

import { useEffect, useRef } from "react";
import { createSttSession } from "@/lib/audio/stt";
import { createDeliveryLedger } from "@/lib/interview/delivery-ledger";
import { countFillers } from "@/lib/interview/delivery-metrics";
import { createLatencySpan } from "@/lib/interview/latency";

/**
 * S4 slice 3/5: the room's measurement infrastructure. Thirteen refs that the
 * speech engines, the send pipeline and the persistence layer all read or
 * write — they are shared telemetry, not component state, so they move as one
 * block. Everything here was declared verbatim in page.tsx (Phase 8/13):
 * nothing is created or reset differently, and no effect lives here.
 */
export function useInterviewTelemetry() {
  const recordingStartTimeRef = useRef<number | null>(null);
  // One owner for the hesitation count, because both speech engines see the same
  // spoken fillers (see src/lib/interview/delivery-ledger.ts).
  const deliveryLedgerRef = useRef(createDeliveryLedger(countFillers));
  // Seeded on mount rather than at first render: the only readers start after
  // recording begins, and the silence tracker resets it on recording start, so
  // the seed value is overwritten before anyone reads it either way.
  const lastSpeechTimeRef = useRef<number>(0);
  useEffect(() => {
    lastSpeechTimeRef.current = Date.now();
  }, []);
  const lastAnalysisTimeRef = useRef<number>(0);
  // Phase 8: observable delivery analytics (no psychology). Refs only —
  // nothing here is displayed as a score during the interview.
  const sttSessionRef = useRef(createSttSession());
  const interruptionsRef = useRef(0);
  const answerSegmentsRef = useRef<{ startMs: number; endMs: number }[]>([]);
  const roundTripsRef = useRef<number[]>([]);
  // One start, two readers: TTFT is read at the first token and the round trip
  // at the end of the answer, so the span is not consumed by the first.
  const sendSpanRef = useRef(createLatencySpan());
  const unmountedRef = useRef(false);
  // Phase 13: latency breakdown refs (31). TTFT ≈ submit→streaming;
  // whisper = post→complete turnaround; TTS = speak-request→first audio.
  const ttftSamplesRef = useRef<number[]>([]);
  const whisperTurnaroundsRef = useRef<number[]>([]);
  const whisperSpanRef = useRef(createLatencySpan());
  const ttsStartupSamplesRef = useRef<number[]>([]);
  const ttsSpanRef = useRef(createLatencySpan());

  return {
    recordingStartTimeRef,
    deliveryLedgerRef,
    lastSpeechTimeRef,
    lastAnalysisTimeRef,
    sttSessionRef,
    interruptionsRef,
    answerSegmentsRef,
    roundTripsRef,
    sendSpanRef,
    unmountedRef,
    ttftSamplesRef,
    whisperTurnaroundsRef,
    whisperSpanRef,
    ttsStartupSamplesRef,
    ttsSpanRef,
  };
}
