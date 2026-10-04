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
 * Scope: the ledger owns the count for answers recorded in *this* mount. A
 * session restored from localStorage writes the display directly, so a
 * restored number is not part of `total()` and the next recorded answer
 * replaces it — the same as before this module existed.
 */
export interface DeliveryLedger {
  /** Open a new answer window. Called when recording starts. */
  beginAnswer(): void;
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
