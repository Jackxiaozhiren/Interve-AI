/**
 * One owner for the hesitation count.
 *
 * The room drives two speech engines over the same microphone: the browser's
 * `SpeechRecognition` streams interim/final drafts for live telemetry, and the
 * recorded audio goes to Whisper, whose final transcript is the text the
 * candidate's answer actually becomes. Both engines see the same spoken
 * fillers, so with each one writing the displayed total independently the
 * number double-counts whenever a browser result arrives after the Whisper
 * commit — which is the ordinary ordering, because `recognition.stop()` still
 * flushes a final result while the worker is resolving.
 *
 * The rule the ledger encodes: **the committed Whisper final is authoritative
 * for its answer, and a draft can only ever be provisional.** `beginAnswer()`
 * opens a window (the page calls it when recording starts); inside one window
 * at most one commit lands, and drafts after that commit stop adding.
 *
 * Scope: the ledger owns the count for the whole mounted room. A session
 * restored from localStorage hands its stored number to `seed()` rather than
 * writing the display behind the ledger's back, so the restored history is the
 * baseline the next answer adds to. Before that, the first hesitant answer
 * replaced a restored "口头禅 5 次" with just its own count.
 */
export interface DeliveryLedger {
  /** Open a new answer window. Called when recording starts. */
  beginAnswer(): void;
  /**
   * Adopt a baseline the ledger did not observe — a count restored from an
   * unfinished session. Sets rather than adds, so restoring twice cannot inflate.
   * Returns the new total so the caller can render it without a second read.
   */
  seed(value: number): number;
  /** Committed total so far, excluding anything in flight. */
  total(): number;
  /**
   * What to display while an answer is being spoken. Adds the fillers in the
   * browser's draft to the committed total, unless this answer has already
   * committed — in which case the draft is stale relative to the authoritative
   * text and is ignored.
   */
  provisionalFromDraft(draftText: string): number;
  /**
   * Commit the answer's final transcript. Idempotent within an answer window:
   * a second call returns the same total without adding again.
   */
  commitFinalFromWhisper(finalText: string): number;
}

export function createDeliveryLedger(countFillers: (text: string) => number): DeliveryLedger {
  let total = 0;
  let committedForThisAnswer = false;

  return {
    beginAnswer() {
      committedForThisAnswer = false;
    },
    seed(value) {
      total = value;
      return total;
    },
    total() {
      return total;
    },
    provisionalFromDraft(draftText) {
      if (committedForThisAnswer) return total;
      return total + countFillers(draftText);
    },
    commitFinalFromWhisper(finalText) {
      if (committedForThisAnswer) return total;
      committedForThisAnswer = true;
      total += countFillers(finalText);
      return total;
    },
  };
}
