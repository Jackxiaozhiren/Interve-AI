/**
 * The browser SpeechRecognition wiring for the live interview room.
 *
 * Extracted from `src/app/interview/page.tsx` (Phase: interview-page slice 4).
 * The page owns React state; this owns the transcript assembly and the
 * restart policy, which is the part that was untestable while it lived inside
 * `startRecording()` behind a real `window.SpeechRecognition`.
 *
 * Two properties worth naming because they are easy to lose:
 * - `accumulatedDraft` only advances on a non-empty final. An empty final must
 *   not concat, or the draft grows whitespace and `countFillers` sees a longer
 *   text than the candidate spoke.
 * - the restart budget is per-session and only for `network`. `no-speech` is
 *   ordinary silence and `not-allowed` needs the candidate, not a retry loop.
 */

export interface SpeechAlternative {
  transcript: string;
  confidence?: number;
}

export interface SpeechResultList {
  readonly length: number;
  isFinal: boolean;
  [index: number]: SpeechAlternative;
}

export interface SpeechResultEvent {
  resultIndex: number;
  results: { readonly length: number; [index: number]: SpeechResultList };
}

export interface SpeechErrorEvent {
  error: string;
}

/** The subset of SpeechRecognition this module drives — injectable in tests. */
export interface SpeechRecognitionLike {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: SpeechResultEvent) => void) | null;
  onerror: ((event: SpeechErrorEvent) => void) | null;
  start(): void;
  stop(): void;
}

export interface SpeechRecognitionConstructor {
  new (): SpeechRecognitionLike;
}

/** `window` plus the two vendor spellings of the Web Speech API. */
export interface WindowWithSpeech extends Window {
  SpeechRecognition?: SpeechRecognitionConstructor;
  webkitSpeechRecognition?: SpeechRecognitionConstructor;
}

export interface SpeechSessionSinks {
  /** Observability only — one call per recognised segment. */
  stt: {
    recordFinal(transcript: string, confidence?: number): void;
    recordPartial(transcript: string): void;
    recordReconnect(): void;
  };
  /** Fired for every result event with the assembled draft and the filler
   *  delta since the previous event in this session. `newFillers` is 0 when
   *  the draft did not gain fillers, including when it lost them to a
   *  correction — the page must not charge cognitive load for a re-word. */
  onDraft(update: { draft: string; fillersInDraft: number; newFillers: number }): void;
  /** Called once when the draft gains fillers, for the hesitation load bump. */
  onWarning(message: string): void;
}

export interface SpeechSessionOptions extends SpeechSessionSinks {
  create(): SpeechRecognitionLike;
  countFillers(text: string): number;
  /** Network drops retried before giving up. Default 3, matching the old inline value. */
  maxRestarts?: number;
}

export interface SpeechSession {
  recognition: SpeechRecognitionLike;
  restarts(): number;
}

export function startSpeechSession(opts: SpeechSessionOptions): SpeechSession {
  const recognition = opts.create();

  recognition.continuous = true;
  recognition.interimResults = true;
  recognition.lang = "zh-CN";

  let accumulatedDraft = "";
  let localFillerCount = 0;
  let restarts = 0;
  const maxRestarts = opts.maxRestarts ?? 3;

  recognition.onresult = (event: SpeechResultEvent) => {
    let interimTranscript = "";
    let finalTranscript = "";

    for (let i = event.resultIndex; i < event.results.length; ++i) {
      const list = event.results[i];
      const alternative = list[0];
      if (list.isFinal) {
        finalTranscript += alternative.transcript;
        opts.stt.recordFinal(alternative.transcript, alternative.confidence);
      } else {
        interimTranscript += alternative.transcript;
        opts.stt.recordPartial(alternative.transcript);
      }
    }

    const draft = accumulatedDraft + finalTranscript + interimTranscript;
    const fillersInDraft = opts.countFillers(draft);
    // Clamped: a re-word can remove a filler, and a negative "new fillers" is
    // a meaningless value to hand a caller that charges load for the delta.
    const newFillers = Math.max(0, fillersInDraft - localFillerCount);
    if (newFillers > 0) localFillerCount = fillersInDraft;

    opts.onDraft({ draft, fillersInDraft, newFillers });

    if (finalTranscript.trim()) accumulatedDraft += finalTranscript;
  };

  recognition.onerror = (e: SpeechErrorEvent) => {
    opts.onWarning(`Speech recognition error: ${e.error}`);
    if (e.error === "network" && restarts < maxRestarts) {
      restarts += 1;
      opts.stt.recordReconnect();
      try {
        recognition.start();
      } catch {
        // already running — the next result will arrive on its own
      }
    }
  };

  recognition.start();

  return { recognition, restarts: () => restarts };
}
