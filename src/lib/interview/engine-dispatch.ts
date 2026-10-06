/**
 * The interview room's two speech-engine worker handlers.
 *
 * These lived inline in `src/app/interview/page.tsx` inside the worker
 * initialisation effect, which meant nothing could reach them: the browser
 * harness runs with `testMode=true`, and that branch returns before any worker
 * is created, so no lane ever dispatched a message. A transcript that arrives
 * with the wrong shape silently loses its words-per-minute reading, its
 * hesitation count, or its STAR analysis, and no check would have noticed.
 *
 * The bodies are the page's own, moved without edits. The page's refs are
 * passed through as `{ current }` boxes rather than being unwrapped, because
 * the handlers must read them at dispatch time: a captured value would freeze
 * the recording start instant and the analysis throttle at the moment the
 * effect ran, which is exactly the staleness bug the refs were there to avoid.
 *
 * Two things are injected rather than imported. The analysis sinks come in as a
 * getter so the store is still read per utterance (`getState()` at call time,
 * never a snapshot). The toast comes in as an object because no module under
 * `src/lib` is allowed to depend on `sonner` — the copy below is the candidate's
 * error text, and injecting it is what lets a unit test assert it.
 */
import { computeWpm, shouldRunAnalysis } from "./delivery-metrics";
import type { DeliveryLedger } from "./delivery-ledger";
import type { LatencySpan } from "./latency";
import { runTurnAnalysis } from "./turn-analysis";
import type { StarSink, TraitsSink } from "./analysis-projection";

/** The mutable half of a `useRef` — kept late-reading on purpose. */
type Box<T> = { current: T };

type Setter<T> = (value: T) => void;

/** The two `sonner` methods the handlers use, as method slots (bivariant args). */
export interface ToastSink {
  error(message: string, opts: { description: string }): void;
  info(message: string, opts: { description: string }): void;
}

export interface WhisperDispatchDeps {
  deliveryLedgerRef: Box<DeliveryLedger>;
  whisperSpanRef: Box<LatencySpan>;
  whisperTurnaroundsRef: Box<number[]>;
  recordingStartTimeRef: Box<number | null>;
  lastAnalysisTimeRef: Box<number>;
  activeCodeContextRef: Box<string>;
  activeSystemDesignContextRef: Box<string>;
  handleUserInputRef: Box<((text: string) => Promise<void>) | null>;
  setWpm: Setter<number>;
  setFillerWordsCount: Setter<number>;
  setModelStatus: Setter<string>;
  /** Read per utterance, so an analysis payload never carries a stale store. */
  getAnalysisSinks: () => StarSink & TraitsSink;
  toast: ToastSink;
}

/**
 * Handles one `whisper.worker` message: a transcript is a candidate's answer, so
 * it closes the STT latency span, scores the delivery, becomes the submitted
 * text, and (when the throttle allows) triggers the analysis routes.
 */
export function createWhisperDispatch(deps: WhisperDispatchDeps) {
  const {
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
    getAnalysisSinks,
    toast,
  } = deps;

  return (e: MessageEvent) => {
    const { status, text, error } = e.data;
    if (status === 'ready') {
      console.log("Whisper ready");
    } else if (status === 'complete' && text) {
      // Phase 13: STT latency turnaround.
      whisperSpanRef.current.collectInto(whisperTurnaroundsRef.current);
      setModelStatus("");

      // Delivery Analysis Logic (E1: pure helpers, behavior-identical)
      if (recordingStartTimeRef.current) {
        const durationMinutes = (Date.now() - recordingStartTimeRef.current) / 60000;
        const currentWpm = computeWpm(text, durationMinutes);
        if (currentWpm !== null) setWpm(currentWpm);
        recordingStartTimeRef.current = null;
      }

      // The Whisper final is the answer's authoritative text, so it — not the
      // browser draft — owns the hesitation count for this answer.
      setFillerWordsCount(deliveryLedgerRef.current.commitFinalFromWhisper(text));

      // Send transcribed text to API; void-marked because a rejected send must not surface as an unhandled rejection while the transcript is already the candidate's turn.
      if (handleUserInputRef.current) {
        void handleUserInputRef.current(text.trim());
      }

      const trimmedText = text.trim();
      const now = Date.now();

      // Only trigger heavy STAR and Behavioral analysis if the utterance is substantial and sufficient time has passed (Throttle)
      // This acts as a cooling mechanism to save API calls and prevent backend congestion from rapid rapid stop-start recordings.
      // E1: gate ported verbatim to shouldRunAnalysis (unit-tested).
      if (shouldRunAnalysis({
        textLen: trimmedText.length,
        nowMs: now,
        lastMs: lastAnalysisTimeRef.current,
        hasCodeCtx: Boolean(activeCodeContextRef.current),
        hasDesignCtx: Boolean(activeSystemDesignContextRef.current),
      })) {

        lastAnalysisTimeRef.current = now;

        // Phase 35 + 31: STAR progress and behavioral tracking for this
        // utterance. Extracted to runTurnAnalysis so the dispatch has tests;
        // fire-and-forget as before, because a degraded analysis route must
        // not cost the candidate their turn.
        void runTurnAnalysis(
          {
            transcript: trimmedText,
            codeContext: activeCodeContextRef.current,
            systemDesignContext: activeSystemDesignContextRef.current,
          },
          getAnalysisSinks()
        );
      }

    } else if (status === 'error') {
      console.error("Whisper Error:", error);
      setModelStatus("语音识别出错");
      toast.error("语音识别加载失败", { description: "硬件加速或模型资源不可用，请刷新重试" });
    }
  };
}

export interface KokoroDispatchDeps {
  setModelsReady: Setter<boolean>;
  setModelStatus: Setter<string>;
  setIsUsingNativeTTS: Setter<boolean>;
  setIsAiSpeaking: Setter<boolean>;
  playAudio: (audio: Float32Array, sampleRate: number) => Promise<void>;
  toast: ToastSink;
}

/**
 * Handles one `kokoro.worker` message. The error branch is the room's
 * degradation path: a failed TTS model must still leave the candidate able to
 * hear questions, so it falls back to the browser's own speech rather than
 * blocking the interview.
 */
export function createKokoroDispatch(deps: KokoroDispatchDeps) {
  const {
    setModelsReady,
    setModelStatus,
    setIsUsingNativeTTS,
    setIsAiSpeaking,
    playAudio,
    toast,
  } = deps;

  return async (e: MessageEvent) => {
    const { status, audio, sampleRate, error } = e.data;
    if (status === 'ready') {
      setModelsReady(true);
      setModelStatus("");
    } else if (status === 'complete' && audio) {
      setModelStatus("");
      await playAudio(audio, sampleRate || 24000);
    } else if (status === 'error') {
      console.warn("Kokoro模型加载失败，已切换至浏览器原生语音:", error);
      setIsUsingNativeTTS(true);
      setModelsReady(true); // Make the app usable even if Kokoro fails
      setModelStatus("");
      setIsAiSpeaking(false);
      toast.info("已切换至基础语音模式", { description: "高级语音模型加载失败，但不影响核心面试流程" });
    }
  };
}
