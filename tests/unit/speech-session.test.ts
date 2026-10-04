import { describe, expect, it, vi } from "vitest";
import {
  startSpeechSession,
  type SpeechRecognitionLike,
  type SpeechResultEvent,
} from "@/lib/interview/speech-session";
import { countFillers } from "@/lib/interview/delivery-metrics";

function fakeRecognition(): SpeechRecognitionLike {
  return {
    continuous: false,
    interimResults: false,
    lang: "",
    onresult: null,
    onerror: null,
    start: vi.fn(),
    stop: vi.fn(),
  };
}

const alt = (transcript: string, confidence?: number) =>
  confidence === undefined ? { transcript } : { transcript, confidence };

const ev = (
  resultIndex: number,
  ...lists: Array<{ isFinal: boolean; alts: ReturnType<typeof alt>[] }>
): SpeechResultEvent =>
  ({
    resultIndex,
    results: lists.map((l) => ({
      isFinal: l.isFinal,
      length: l.alts.length,
      ...Object.fromEntries(l.alts.map((a, i) => [i, a])),
    })),
  }) as unknown as SpeechResultEvent;

function harness() {
  const rec = fakeRecognition();
  const stt = { recordFinal: vi.fn(), recordPartial: vi.fn(), recordReconnect: vi.fn() };
  const warn = vi.fn();
  const drafts: Array<{ draft: string; fillersInDraft: number; newFillers: number }> = [];
  const session = startSpeechSession({
    create: () => rec,
    countFillers,
    stt,
    onDraft: (u) => drafts.push(u),
    onWarning: warn,
  });
  return { rec, stt, warn, drafts, session };
}

describe("startSpeechSession configuration", () => {
  it("sets the live-room flags and starts immediately", () => {
    const { rec } = harness();
    expect(rec.continuous).toBe(true);
    expect(rec.interimResults).toBe(true);
    expect(rec.lang).toBe("zh-CN");
    expect(rec.start).toHaveBeenCalledTimes(1);
  });
});

describe("transcript assembly", () => {
  it("reports interim text without committing it to the draft", () => {
    const h = harness();
    h.rec.onresult?.(ev(0, { isFinal: false, alts: [alt("你好")] }));
    expect(h.drafts[0].draft).toBe("你好");
    expect(h.stt.recordPartial).toHaveBeenCalledWith("你好");
    expect(h.stt.recordFinal).not.toHaveBeenCalled();
  });

  it("carries a committed final into every later draft", () => {
    const h = harness();
    h.rec.onresult?.(ev(0, { isFinal: true, alts: [alt("第一段。", 0.9)] }));
    h.rec.onresult?.(ev(0, { isFinal: false, alts: [alt("第二段")] }));
    expect(h.drafts[1].draft).toBe("第一段。第二段");
    expect(h.stt.recordFinal).toHaveBeenCalledWith("第一段。", 0.9);
  });

  it("does not let a whitespace-only final pollute the accumulated draft", () => {
    // The old inline code appended any non-empty final; " " is non-empty but
    // lengthens the text countFillers and computeWpm score, so a candidate who
    // pauses silently inflates their own metrics.
    const h = harness();
    h.rec.onresult?.(ev(0, { isFinal: true, alts: [alt("   ")] }));
    h.rec.onresult?.(ev(0, { isFinal: false, alts: [alt("嗯")] }));
    expect(h.drafts[1].draft).toBe("嗯");
  });
});

describe("filler delta", () => {
  // "嗯 嗯" and not "嗯嗯": countFillers matches a Chinese filler only when it
  // stands alone, so two adjacent characters are one run of speech, not two
  // hesitation markers.
  it("charges a new filler once, not on every event that still contains it", () => {
    const h = harness();
    h.rec.onresult?.(ev(0, { isFinal: false, alts: [alt("嗯 嗯")] }));
    h.rec.onresult?.(ev(0, { isFinal: false, alts: [alt("嗯 嗯")] }));
    expect(h.drafts[0].fillersInDraft).toBe(2);
    expect(h.drafts[0].newFillers).toBe(2);
    expect(h.drafts[1].newFillers).toBe(0);
  });

  it("does not lower the baseline when a correction removes fillers", () => {
    // A re-word that drops a filler must not make the next occurrence of the
    // same filler charge load twice.
    const h = harness();
    h.rec.onresult?.(ev(0, { isFinal: false, alts: [alt("嗯 嗯")] }));
    expect(h.drafts[0].fillersInDraft).toBe(2);
    h.rec.onresult?.(ev(0, { isFinal: false, alts: [alt("嗯")] }));
    expect(h.drafts[1].fillersInDraft).toBe(1);
    expect(h.drafts[1].newFillers).toBe(0);
    h.rec.onresult?.(ev(0, { isFinal: false, alts: [alt("嗯 嗯")] }));
    expect(h.drafts[2].newFillers).toBe(0);
  });
});

describe("restart policy", () => {
  const withErrors = () => {
    const rec = fakeRecognition();
    const stt = { recordFinal: vi.fn(), recordPartial: vi.fn(), recordReconnect: vi.fn() };
    const warn = vi.fn();
    const session = startSpeechSession({
      create: () => rec, countFillers, stt, onDraft: vi.fn(), onWarning: warn,
    });
    return { rec, stt, warn, session };
  };

  it("retries a network drop up to the budget and then stops", () => {
    const { rec, stt, session } = withErrors();
    for (let i = 0; i < 5; i++) rec.onerror?.({ error: "network" });
    expect(stt.recordReconnect).toHaveBeenCalledTimes(3);
    expect(session.restarts()).toBe(3);
    // 1 initial start + 3 reconnect attempts.
    expect(rec.start).toHaveBeenCalledTimes(4);
  });

  it("never retries the errors a retry cannot fix", () => {
    for (const error of ["no-speech", "not-allowed", "audio-capture", "aborted"]) {
      const { rec, stt } = withErrors();
      rec.onerror?.({ error });
      expect(stt.recordReconnect, error).not.toHaveBeenCalled();
      expect(rec.start, error).toHaveBeenCalledTimes(1);
    }
  });

  it("survives a start() that throws because the session is already running", () => {
    const { rec, stt } = withErrors();
    (rec.start as ReturnType<typeof vi.fn>).mockImplementation(() => {
      throw new Error("already started");
    });
    expect(() => rec.onerror?.({ error: "network" })).not.toThrow();
    expect(stt.recordReconnect).toHaveBeenCalledTimes(1);
  });

  it("warns on every error, including the ones it will not retry", () => {
    const { rec, warn } = withErrors();
    rec.onerror?.({ error: "no-speech" });
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("no-speech"));
  });
});
