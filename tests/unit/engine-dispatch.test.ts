/**
 * The interview room's speech-engine dispatch, tested without a browser.
 *
 * Before this moved into `src/lib/interview/engine-dispatch.ts`, these branches
 * lived inside the worker-initialisation effect, and the browser harness runs
 * with `testMode=true` — the branch that returns before any worker exists. So no
 * lane had ever dispatched a worker message: a transcript that lost its WPM
 * reading, or an analysis that never fired, was invisible.
 *
 * Every assertion here is two-sided. Where a state update is expected, the test
 * also pins the case that must NOT update, because a dispatch that called the
 * setter unconditionally would otherwise look identical.
 */
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createKokoroDispatch,
  createWhisperDispatch,
  type ToastSink,
} from "@/lib/interview/engine-dispatch";
import { createDeliveryLedger } from "@/lib/interview/delivery-ledger";
import { countFillers } from "@/lib/interview/delivery-metrics";
import { createLatencySpan } from "@/lib/interview/latency";
import type { StarSink, TraitsSink } from "@/lib/interview/analysis-projection";

const msg = (data: unknown) => ({ data } as unknown as MessageEvent);

/** Real clock timers stay live so a fire-and-forget promise can be flushed. */
let nowMs = 1_700_000_000_000;
const flush = async () => {
  await new Promise((resolve) => setTimeout(resolve, 0));
};

function makeToast() {
  const sink: ToastSink = { error: vi.fn(), info: vi.fn() };
  return sink;
}

function makeWhisperDeps() {
  const ledger = createDeliveryLedger(countFillers);
  const span = createLatencySpan();
  const sinksA = {
    setStarProgress: vi.fn(),
    setBehavioralTraits: vi.fn(),
    setStarGrounding: vi.fn(),
    setTraitsGrounding: vi.fn(),
  };
  const sinksB = { ...sinksA, setStarProgress: vi.fn() };
  let sink = sinksA as unknown as StarSink & TraitsSink;
  const deps = {
    deliveryLedgerRef: { current: ledger },
    whisperSpanRef: { current: span },
    whisperTurnaroundsRef: { current: [] as number[] },
    recordingStartTimeRef: { current: null as number | null },
    lastAnalysisTimeRef: { current: 0 },
    activeCodeContextRef: { current: "" },
    activeSystemDesignContextRef: { current: "" },
    handleUserInputRef: {
      current: vi.fn(async () => {}) as unknown as ((text: string) => Promise<void>) | null,
    },
    setWpm: vi.fn(),
    setFillerWordsCount: vi.fn(),
    setModelStatus: vi.fn(),
    getAnalysisSinks: () => sink,
    toast: makeToast(),
  };
  return { deps, sinksA, sinksB, setSink: (next: unknown) => { sink = next as StarSink & TraitsSink; } };
}

function makeKokoroDeps() {
  return {
    deps: {
      setModelsReady: vi.fn(),
      setModelStatus: vi.fn(),
      setIsUsingNativeTTS: vi.fn(),
      setIsAiSpeaking: vi.fn(),
      playAudio: vi.fn(async () => {}),
      toast: makeToast(),
    },
  };
}

/**
 * Every transcript whose gate opens reaches these two routes, so the stub is
 * installed for all tests rather than only the analysis ones: a unit test that
 * reaches the network is slow, environment-dependent, and silently green when
 * the request merely fails. The calls are recorded so a test can assert either
 * "these routes" or "nothing at all".
 */
const analysisCalls: { url: string; body: Record<string, unknown> }[] = [];

const STAR_RESPONSE = {
  s: { progress: 3, evidence: ["I shipped the feature"] },
  t: { progress: 2 },
  a: { progress: 4 },
  r: { progress: 3 },
};
const BEHAVIOR_RESPONSE = {
  leadership: 4,
  ownership: 3,
  communication: 4,
  resilience: 3,
  learningAgility: 3,
};

beforeEach(() => {
  analysisCalls.length = 0;
  nowMs = 1_700_000_000_000;
  vi.spyOn(Date, "now").mockImplementation(() => nowMs);
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
      const key = String(url);
      analysisCalls.push({
        url: key,
        body: init?.body ? (JSON.parse(String(init.body)) as Record<string, unknown>) : {},
      });
      const payload = key === "/api/analyze-star" ? STAR_RESPONSE : BEHAVIOR_RESPONSE;
      return new Response(JSON.stringify(payload), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }) as unknown as typeof fetch
  );
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("whisper dispatch: a transcript is an answer", () => {
  it("collects one STT turnaround per transcript, and never a second for a closed span", () => {
    const { deps } = makeWhisperDeps();
    const handle = createWhisperDispatch(deps);
    deps.whisperSpanRef.current.start(nowMs - 400);

    handle(msg({ status: "complete", text: "hello there" }));
    expect(deps.whisperTurnaroundsRef.current).toEqual([400]);

    // The span already closed; a duplicate or late worker message must not
    // inflate the latency sample list.
    handle(msg({ status: "complete", text: "hello there" }));
    expect(deps.whisperTurnaroundsRef.current).toHaveLength(1);
  });

  it("clears the status line as soon as the transcript lands", () => {
    const { deps } = makeWhisperDeps();
    deps.setModelStatus.mockImplementation(() => {});
    createWhisperDispatch(deps)(msg({ status: "complete", text: "hello there" }));
    expect(deps.setModelStatus).toHaveBeenCalledWith("");
  });

  it("scores WPM over the recording window and then closes that window", () => {
    const { deps } = makeWhisperDeps();
    deps.recordingStartTimeRef.current = nowMs - 60_000;
    const handle = createWhisperDispatch(deps);

    // Twelve words in one minute is twelve words per minute.
    handle(msg({ status: "complete", text: "one two three four five six seven eight nine ten eleven twelve" }));
    expect(deps.setWpm).toHaveBeenCalledWith(12);
    expect(deps.recordingStartTimeRef.current).toBeNull();

    // No window open: the follow-up transcript must not reuse the old one.
    deps.setWpm.mockClear();
    handle(msg({ status: "complete", text: "and then some more words arrived here" }));
    expect(deps.setWpm).not.toHaveBeenCalled();
  });

  it("reports nothing for a sub-three-second window but still lands the rest of the turn", () => {
    const { deps } = makeWhisperDeps();
    deps.recordingStartTimeRef.current = nowMs - 1_000;

    createWhisperDispatch(deps)(msg({ status: "complete", text: "too fast to measure" }));

    expect(deps.setWpm).not.toHaveBeenCalled();
    expect(deps.recordingStartTimeRef.current).toBeNull();
    expect(deps.handleUserInputRef.current).toHaveBeenCalledWith("too fast to measure");
    expect(deps.setFillerWordsCount).toHaveBeenCalled();
  });

  it("takes the hesitation count from the Whisper final, and only once per answer", () => {
    const { deps } = makeWhisperDeps();
    deps.deliveryLedgerRef.current.beginAnswer();
    const handle = createWhisperDispatch(deps);

    // "um" and "you know" are two fillers; the draft is irrelevant here.
    handle(msg({ status: "complete", text: "um I you know led the team" }));
    expect(deps.setFillerWordsCount).toHaveBeenLastCalledWith(2);

    // A duplicate final for the same answer must not double-count.
    handle(msg({ status: "complete", text: "um I you know led the team" }));
    expect(deps.setFillerWordsCount).toHaveBeenLastCalledWith(2);
  });

  it("submits the trimmed transcript, and survives a torn-down submit handler", () => {
    const { deps } = makeWhisperDeps();
    const handle = createWhisperDispatch(deps);

    handle(msg({ status: "complete", text: "  spaced out  " }));
    expect(deps.handleUserInputRef.current).toHaveBeenCalledWith("spaced out");

    deps.handleUserInputRef.current = null;
    expect(() => handle(msg({ status: "complete", text: "after teardown" }))).not.toThrow();
    // The turn is still recorded even though nobody can receive it.
    expect(deps.setFillerWordsCount).toHaveBeenCalled();
  });

  it("asks the analysis routes once, then cools down for the next utterance", async () => {
    const { deps } = makeWhisperDeps();
    const handle = createWhisperDispatch(deps);

    handle(msg({ status: "complete", text: "I shipped the feature and measured it" }));
    await flush();
    expect(analysisCalls.map((c) => c.url).sort()).toEqual(["/api/analyze-behavior", "/api/analyze-star"]);

    analysisCalls.length = 0;
    handle(msg({ status: "complete", text: "and then I explained the tradeoff" }));
    await flush();
    expect(analysisCalls, "the 15s throttle did not hold").toEqual([]);
  });

  it("leaves a short utterance alone when no board context is open", async () => {
    const { deps } = makeWhisperDeps();

    createWhisperDispatch(deps)(msg({ status: "complete", text: "yes." }));
    await flush();
    expect(analysisCalls).toEqual([]);
    expect(deps.lastAnalysisTimeRef.current).toBe(0);
  });

  // Two separate cases, one per board, because the gate is a disjunction: with
  // both contexts open, a plant that hard-codes either one to false still lets
  // the other clause fire, and the test would report a pass on a broken gate.
  it("opens the gate for a short utterance on the code board alone, and carries both contexts", async () => {
    const { deps } = makeWhisperDeps();
    deps.activeCodeContextRef.current = "func main() {}";

    createWhisperDispatch(deps)(msg({ status: "complete", text: "here." }));
    await flush();

    const star = analysisCalls.find((c) => c.url === "/api/analyze-star");
    expect(star?.body).toEqual({
      transcript: "here.",
      codeContext: "func main() {}",
      systemDesignContext: "",
    });
  });

  it("opens the gate for a short utterance on the design board alone", async () => {
    const { deps } = makeWhisperDeps();
    deps.activeSystemDesignContextRef.current = "boxes and arrows";

    createWhisperDispatch(deps)(msg({ status: "complete", text: "here." }));
    await flush();

    expect(analysisCalls.map((c) => c.url).sort()).toEqual(["/api/analyze-behavior", "/api/analyze-star"]);
  });

  it("reads the store at dispatch time, not at effect time", async () => {
    const { deps, sinksA, sinksB, setSink } = makeWhisperDeps();
    const handle = createWhisperDispatch(deps);

    handle(msg({ status: "complete", text: "first substantial answer here" }));
    await flush();
    expect(sinksA.setStarProgress).toHaveBeenCalledTimes(1);
    expect(sinksB.setStarProgress).not.toHaveBeenCalled();

    nowMs += 16_000;
    setSink(sinksB);
    handle(msg({ status: "complete", text: "second substantial answer" }));
    await flush();
    expect(analysisCalls).toHaveLength(4);
    expect(sinksA.setStarProgress).toHaveBeenCalledTimes(1);
    expect(sinksB.setStarProgress).toHaveBeenCalledTimes(1);
  });

  it("marks the turn as a voice-recognition failure with the candidate's own words", () => {
    const { deps } = makeWhisperDeps();

    createWhisperDispatch(deps)(msg({ status: "error", error: "model download refused" }));

    expect(deps.setModelStatus).toHaveBeenCalledWith("语音识别出错");
    expect(deps.toast.error).toHaveBeenCalledWith("语音识别加载失败", {
      description: "硬件加速或模型资源不可用，请刷新重试",
    });
    expect(deps.handleUserInputRef.current).not.toHaveBeenCalled();
    expect(deps.setFillerWordsCount).not.toHaveBeenCalled();
  });

  it("does nothing at all on ready", () => {
    const { deps } = makeWhisperDeps();
    const log = vi.spyOn(console, "log").mockImplementation(() => {});

    createWhisperDispatch(deps)(msg({ status: "ready" }));

    expect(log).toHaveBeenCalledWith("Whisper ready");
    expect(deps.setModelStatus).not.toHaveBeenCalled();
    expect(deps.setFillerWordsCount).not.toHaveBeenCalled();
    expect(deps.setWpm).not.toHaveBeenCalled();
    expect(deps.handleUserInputRef.current).not.toHaveBeenCalled();
  });
});

describe("kokoro dispatch: a failed TTS model must not stop the interview", () => {
  it("opens the room when the model reports ready", () => {
    const { deps } = makeKokoroDeps();

    return createKokoroDispatch(deps)(msg({ status: "ready" })).then(() => {
      expect(deps.setModelsReady).toHaveBeenCalledWith(true);
      expect(deps.setModelStatus).toHaveBeenCalledWith("");
      expect(deps.playAudio).not.toHaveBeenCalled();
    });
  });

  it("plays returned audio at its own rate, defaulting to 24kHz", async () => {
    const { deps } = makeKokoroDeps();
    const handle = createKokoroDispatch(deps);
    const audio = new Float32Array([0.1, 0.2]);

    await handle(msg({ status: "complete", audio }));
    expect(deps.playAudio).toHaveBeenCalledWith(audio, 24000);

    await handle(msg({ status: "complete", audio, sampleRate: 22050 }));
    expect(deps.playAudio).toHaveBeenLastCalledWith(audio, 22050);

    // A completion with nothing to play must not reach the audio graph.
    deps.playAudio.mockClear();
    await handle(msg({ status: "complete" }));
    expect(deps.playAudio).not.toHaveBeenCalled();
  });

  it("falls back to native speech, and says so once", async () => {
    const { deps } = makeKokoroDeps();
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    await createKokoroDispatch(deps)(msg({ status: "error", error: "onnx load failed" }));

    expect(warn).toHaveBeenCalled();
    expect(deps.setIsUsingNativeTTS).toHaveBeenCalledWith(true);
    expect(deps.setModelsReady).toHaveBeenCalledWith(true);
    expect(deps.setIsAiSpeaking).toHaveBeenCalledWith(false);
    expect(deps.toast.info).toHaveBeenCalledWith("已切换至基础语音模式", {
      description: "高级语音模型加载失败，但不影响核心面试流程",
    });
  });

  it("ignores a status it does not know", async () => {
    const { deps } = makeKokoroDeps();

    await createKokoroDispatch(deps)(msg({ status: "progress", percent: 40 }));

    expect(deps.setModelsReady).not.toHaveBeenCalled();
    expect(deps.playAudio).not.toHaveBeenCalled();
    expect(deps.toast.error).not.toHaveBeenCalled();
  });
});

describe("the injection seam is real", () => {
  /**
   * The module's docstring says toast is injected because nothing under src/lib
   * may depend on sonner. That claim is only worth keeping if it is a property of
   * the tree, so it is checked over the tree: every lib file is read (the count
   * below is the control that the walk is not silently empty), and a positive
   * control outside src/lib proves the scanner can find the import at all.
   */
  const MODULE_RE = /from\s+["']sonner["']/;

  function libFiles(dir = "src/lib"): string[] {
    const out: string[] = [];
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) out.push(...libFiles(full));
      else if (/\.(ts|tsx)$/.test(entry.name)) out.push(full);
    }
    return out;
  }

  it("finds no sonner import in src/lib", () => {
    const files = libFiles();
    expect(files.length, "the src/lib walk found nothing to scan").toBeGreaterThan(30);
    const offenders = files.filter((f) => MODULE_RE.test(readFileSync(f, "utf8")));
    expect(offenders).toEqual([]);
  });

  it("would have found one if the scanner were dead", () => {
    const files = libFiles("src");
    const withSonner = files.filter((f) => MODULE_RE.test(readFileSync(f, "utf8")));
    expect(withSonner.length, "no component imports sonner, so the control proves nothing").toBeGreaterThan(0);
    expect(withSonner.every((f) => !f.startsWith("src/lib"))).toBe(true);
  });
});
