"use client";

/* eslint-disable react-hooks/immutability, react-hooks/refs --
   These hooks deliberately operate on refs owned by the caller: the room shares
   one MediaRecorder / Worker instance across slices, so the ref object is a
   handle, not immutable state. React's own ref contract allows writing
   `.current` outside render; the compiler rule assumes hook arguments are
   immutable, which is not true for refs by design. Every write below happens in
   an event handler or an effect, never during render. */

import { useEffect } from "react";
import { db } from "@/lib/db";
import { toast } from "sonner";
import { createWhisperDispatch, createKokoroDispatch } from "@/lib/interview/engine-dispatch";
import { ensureKnowledgeHub } from "@/lib/orama-client";
import { useInterveStore } from "@/store/useInterveStore";
import type { SpeechRecognitionLike } from "@/lib/interview/speech-session";

/**
 * S4 slice 7: worker lifecycle (Phase 13). The construction effect moved
 * verbatim from page.tsx: resume text load, whisper/kokoro worker creation,
 * dispatch wiring, load triggers, the idempotent knowledge-hub retry and the
 * dispose cascade. The page keeps playback and recognizer refs because their
 * handlers interleave with the send pipeline.
 */
export function useModelWorkers(opts: {
  testMode: boolean;
  searchParams: URLSearchParams | null;
  speechRecognitionRef: React.RefObject<SpeechRecognitionLike | null>;
  setResumeText: (t: string) => void;
  setProblemStatement: (t: string) => void;
  setWpm: (n: number) => void;
  setFillerWordsCount: (n: number) => void;
  setIsAiSpeaking: (b: boolean) => void;
  playAudio: (data: Float32Array, sampleRate: number) => Promise<void>;
  telemetry: ReturnType<typeof import("./useInterviewTelemetry").useInterviewTelemetry>;
  work: ReturnType<typeof import("./useRoomWorkState").useRoomWorkState>;
  model: ReturnType<typeof import("./useModelRuntime").useModelRuntime>;
  handleUserInputRef: { current: ((text: string) => Promise<void>) | null };
  whisperWorker: React.RefObject<Worker | null>;
  kokoroWorker: React.RefObject<Worker | null>;
  audioContext: React.RefObject<AudioContext | null>;
}) {
  const {
    testMode, searchParams, speechRecognitionRef, setResumeText, setProblemStatement,
    setWpm, setFillerWordsCount,
    setIsAiSpeaking, playAudio, telemetry, work, model, handleUserInputRef,
    whisperWorker, kokoroWorker, audioContext,
  } = opts;
  const {
    deliveryLedgerRef, whisperSpanRef, whisperTurnaroundsRef,
    recordingStartTimeRef, lastAnalysisTimeRef,
  } = telemetry;
  const { activeCodeContextRef, activeSystemDesignContextRef } = work;
  const { setModelsReady, setModelStatus, setIsUsingNativeTTS } = model;

  useEffect(() => {
    // Load resume text from db if available
    const interviewId = searchParams?.get('id');
    if (interviewId) {
      db.interviews.get(parseInt(interviewId, 10)).then((interview) => {
        if (interview?.resumeText) {
          setResumeText(interview.resumeText);
          // The reader has been live since Phase B4 and the writer had no caller, so
          // `orama_index` was empty in production and every per-answer retrieval
          // answered nothing. This is where the resume text and the reader meet.
          void ensureKnowledgeHub(interview.resumeText).then((outcome) => {
            if (outcome === "memory-only") console.warn("knowledge hub: built in memory only — the row was refused, so a reload starts empty");
          });
        }
        if (interview?.problemStatement) {
          setProblemStatement(interview.problemStatement);
        }
      }).catch(console.error);
    }

    // We instantiate workers using Next.js compatible syntax
    if (testMode) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setModelsReady(true);
      setIsUsingNativeTTS(true);
      setModelStatus("");
      return;
    }

    whisperWorker.current = new Worker(new URL('../../../workers/whisper.worker.ts', import.meta.url), { type: 'module' });
    kokoroWorker.current = new Worker(new URL('../../../workers/kokoro.worker.ts', import.meta.url), { type: 'module' });

    audioContext.current = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)({ sampleRate: 24000 });

    const handleWhisperMessage = createWhisperDispatch({
      deliveryLedgerRef,
      whisperSpanRef,
      whisperTurnaroundsRef,
      recordingStartTimeRef,
      lastAnalysisTimeRef,
      activeCodeContextRef,
      activeSystemDesignContextRef,
      handleUserInputRef,
      setWpm,
      setFillerWordsCount,
      setModelStatus,
      getAnalysisSinks: () => useInterveStore.getState(),
      toast,
    });

    const handleKokoroMessage = createKokoroDispatch({
      setModelsReady,
      setModelStatus,
      setIsUsingNativeTTS,
      setIsAiSpeaking,
      playAudio,
      toast,
    });

    whisperWorker.current.addEventListener('message', handleWhisperMessage);
    kokoroWorker.current.addEventListener('message', handleKokoroMessage);

    // Trigger loads
    whisperWorker.current.postMessage({ type: 'load' });
    kokoroWorker.current.postMessage({ type: 'load' });

    // Restore Orama Knowledge Hub if needed. Idempotent: `ensure` returns the
    // moment an instance exists, so this is a no-op when the mount effect already
    // restored or built it, and a second chance when that one raced the data load.
    import('@/lib/orama-client').then(({ ensureKnowledgeHub }) => {
      void ensureKnowledgeHub(null);
    });

    return () => {
      if (whisperWorker.current) {
        whisperWorker.current.postMessage({ type: 'dispose' });
        const worker = whisperWorker.current;
        setTimeout(() => worker.terminate(), 200);
      }
      if (kokoroWorker.current) {
        kokoroWorker.current.postMessage({ type: 'dispose' });
        const worker = kokoroWorker.current;
        setTimeout(() => worker.terminate(), 200);
      }
      if (speechRecognitionRef.current) {
        speechRecognitionRef.current.stop();
      }
      if (audioContext.current?.state !== 'closed') {
         audioContext.current?.close();
      }
      window.speechSynthesis.cancel();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

}
