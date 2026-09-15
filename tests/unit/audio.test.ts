// Phase 8: audio primitive unit tests (19.1-19.3).
import { describe, it, expect } from "vitest";
import {
  vadStep,
  averageSpectrum,
  micConstraints,
  VAD_DEFAULTS,
} from "../../src/lib/audio/vad";
import { createSttSession, detectLang } from "../../src/lib/audio/stt";
import { summarizeDelivery, avgLatencyMs } from "../../src/lib/audio/delivery";

describe("vadStep", () => {
  it("requires sustained loud frames before triggering", () => {
    let c = 0;
    for (let i = 0; i < VAD_DEFAULTS.consecutiveFramesRequired - 1; i++) {
      const s = vadStep(c, VAD_DEFAULTS.threshold + 10);
      c = s.consecutive;
      expect(s.triggered).toBe(false);
    }
    expect(vadStep(c, VAD_DEFAULTS.threshold + 10).triggered).toBe(true);
  });

  it("decays on quiet frames (blips don't interrupt)", () => {
    expect(vadStep(4, 0).triggered).toBe(false);
    expect(vadStep(4, 0).consecutive).toBe(3);
    expect(vadStep(0, 0).consecutive).toBe(0);
  });

  it("threshold boundary is strict", () => {
    expect(vadStep(99, VAD_DEFAULTS.threshold).triggered).toBe(false);
  });
});

describe("averageSpectrum", () => {
  it("means bytes, empty is 0", () => {
    expect(averageSpectrum(new Uint8Array([0, 100, 200]))).toBe(100);
    expect(averageSpectrum(new Uint8Array(0))).toBe(0);
  });
});

describe("micConstraints", () => {
  it("always enables echo cancellation; device is ideal-only", () => {
    expect(micConstraints()).toMatchObject({ echoCancellation: true, noiseSuppression: true });
    const withDevice = micConstraints("abc");
    expect(withDevice).toMatchObject({ deviceId: { ideal: "abc" } });
    expect(JSON.stringify(withDevice)).not.toContain("exact");
  });
});

describe("detectLang", () => {
  it("tags CJK vs latin", () => {
    expect(detectLang("你好世界")).toBe("zh");
    expect(detectLang("hello world")).toBe("en");
    expect(detectLang("...")).toBe("other");
    expect(detectLang("hello 世界")).toBe("zh");
  });
});

describe("createSttSession", () => {
  it("tracks partials/finals/confidence/reconnects/switches", () => {
    const s = createSttSession();
    s.recordPartial("hel");
    s.recordPartial("hello");
    s.recordFinal("hello world", 0.9);
    s.recordFinal("你好", 0.8); // switch 1: en → zh
    s.recordFinal("ok", null); // switch 2: zh → en
    s.recordReconnect();
    const st = s.stats();
    expect(st.partials).toBe(2);
    expect(st.finals).toBe(3);
    expect(st.avgConfidence).toBeCloseTo(0.85);
    expect(st.reconnects).toBe(1);
    expect(st.langSwitches).toBe(2);
    expect(st.zhRatio).toBeGreaterThan(0);
  });

  it("reports nulls (never guesses) when empty", () => {
    const st = createSttSession().stats();
    expect(st.avgConfidence).toBeNull();
    expect(st.zhRatio).toBeNull();
    expect(st.finals).toBe(0);
  });
});

describe("summarizeDelivery", () => {
  it("averages segments and round trips, passes through counters", () => {
    const d = summarizeDelivery({
      wpm: 130, fillerWords: 4,
      answerSegments: [{ startMs: 0, endMs: 30_000 }, { startMs: 40_000, endMs: 70_000 }],
      interruptions: 2,
      roundTripsMs: [4000, 6000],
      sttAvgConfidence: 0.87,
      sttFinals: 12,
      sttReconnects: 1,
    });
    expect(d.avgAnswerSec).toBe(30);
    expect(d.avgRoundTripMs).toBe(5000);
    expect(d.interruptions).toBe(2);
    expect(d.sttAvgConfidence).toBe(0.87);
  });

  it("returns nulls (rendered as —) when unmeasured", () => {
    const d = summarizeDelivery({
      wpm: 0, fillerWords: 0, answerSegments: [], interruptions: 0,
      roundTripsMs: [], sttAvgConfidence: null, sttFinals: 0, sttReconnects: 0,
    });
    expect(d.avgAnswerSec).toBeNull();
    expect(d.avgRoundTripMs).toBeNull();
    expect(d.sttAvgConfidence).toBeNull();
    expect(d.interruptions).toBe(0);
  });

  it("ignores non-positive segments", () => {
    const d = summarizeDelivery({
      wpm: 0, fillerWords: 0,
      answerSegments: [{ startMs: 5, endMs: 5 }, { startMs: 0, endMs: 10_000 }],
      interruptions: 0, roundTripsMs: [], sttAvgConfidence: null, sttFinals: 0, sttReconnects: 0,
    });
    expect(d.avgAnswerSec).toBe(10);
  });

  it("avgLatencyMs rounds means, undefined when empty", () => {
    expect(avgLatencyMs([1000, 2000, 3000])).toBe(2000);
    expect(avgLatencyMs([])).toBeUndefined();
  });
});
