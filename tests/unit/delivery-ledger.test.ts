import { describe, expect, it } from "vitest";
import { countFillers } from "@/lib/interview/delivery-metrics";
import { createDeliveryLedger } from "@/lib/interview/delivery-ledger";

/**
 * The room runs two speech engines over the same microphone at once:
 * `SpeechRecognition` streams interim/final drafts, and the recorded audio goes
 * to Whisper, whose final transcript is the authoritative text for the answer.
 * Both of them count fillers, and until now both wrote the same number:
 *
 *   browser path:  setFillerWordsCount(total + countFillers(draft))
 *   whisper path:  total += countFillers(finalText)
 *
 * That composition double-counts whenever a browser result arrives after the
 * Whisper commit for the same answer — which is the normal shape, because
 * `recognition.stop()` still flushes a final result while the worker is already
 * resolving. It never showed up for Chinese because the `\b` bug kept
 * `countFillers` at 0 for that language; fixing the counter activated the race.
 *
 * The first block reproduces the old composition verbatim so the defect stays
 * demonstrated, not just described. The second pins the ledger that replaces it.
 */
function legacyComposition() {
  let total = 0;
  let displayed = 0;
  return {
    onBrowserDraft(draft: string) {
      const inDraft = countFillers(draft);
      if (inDraft > 0) displayed = total + inDraft;
      return displayed;
    },
    onWhisperFinal(text: string) {
      const n = countFillers(text);
      if (n > 0) {
        total = total + n;
        displayed = total;
      }
      return displayed;
    },
    total: () => total,
    displayed: () => displayed,
  };
}

describe("the pre-ledger composition double-counts", () => {
  it("counts the same hesitation twice when a browser result lands after Whisper", () => {
    const h = legacyComposition();
    // One answer, spoken once: "嗯 嗯 然后 那个" — the browser streams it, the
    // recorder hands the same utterance to Whisper, and the browser flushes a
    // late final after the worker already resolved.
    expect(h.onBrowserDraft("嗯 嗯 那个 我觉得可以")).toBe(3);
    expect(h.onWhisperFinal("嗯 嗯 那个 我觉得可以")).toBe(3);
    const late = h.onBrowserDraft("嗯 嗯 那个 我觉得可以");
    // 6 for three spoken fillers. This is the defect, not the expectation.
    expect(late).toBe(6);
    expect(late).toBeGreaterThan(3);
  });
});

describe("createDeliveryLedger", () => {
  const spoken = "嗯 嗯 那个 我觉得可以"; // 3 fillers

  it("treats the committed final as authoritative for its answer", () => {
    const l = createDeliveryLedger(countFillers);
    l.beginAnswer();
    expect(l.provisionalFromDraft(spoken)).toBe(3);
    expect(l.commitFinalFromWhisper(spoken)).toBe(3);
    // The late browser flush must not add a second set.
    expect(l.provisionalFromDraft(spoken)).toBe(3);
    expect(l.total()).toBe(3);
  });

  it("still accumulates across separate answers", () => {
    const l = createDeliveryLedger(countFillers);
    l.beginAnswer();
    l.commitFinalFromWhisper(spoken);            // 3
    l.beginAnswer();
    expect(l.commitFinalFromWhisper("嗯 这里再来一个")).toBe(4); // 3 + 1, measured
    expect(l.total()).toBe(4);
  });

  it("reports a provisional value before any commit without losing the running total", () => {
    const l = createDeliveryLedger(countFillers);
    l.beginAnswer();
    l.commitFinalFromWhisper(spoken);
    l.beginAnswer();
    // Second answer in flight: previous total stays visible, new fillers add.
    expect(l.provisionalFromDraft("嗯")).toBe(4);
    expect(l.total()).toBe(3);
  });

  it("is idempotent for a repeated commit of the same text", () => {
    const l = createDeliveryLedger(countFillers);
    l.beginAnswer();
    expect(l.commitFinalFromWhisper(spoken)).toBe(3);
    expect(l.commitFinalFromWhisper(spoken)).toBe(3);
    expect(l.total()).toBe(3);
  });

  it("counts nothing for an answer with no hesitation", () => {
    const l = createDeliveryLedger(countFillers);
    l.beginAnswer();
    expect(l.commitFinalFromWhisper("我把服务拆成六个模块")).toBe(0);
    expect(l.provisionalFromDraft("我把服务拆成六个模块")).toBe(0);
    expect(l.total()).toBe(0);
  });

  it("does not let a draft that shrinks push the total down", () => {
    const l = createDeliveryLedger(countFillers);
    l.beginAnswer();
    expect(l.provisionalFromDraft(spoken)).toBe(3);
    expect(l.provisionalFromDraft("嗯")).toBe(1);
    expect(l.commitFinalFromWhisper("嗯")).toBe(1);
    expect(l.total()).toBe(1);
  });
});
