// Phase E1: extracted interview-slice units (behavior ports, keyless).
import { describe, it, expect } from "vitest";
import {
  countWords,
  computeWpm,
  countFillers,
  shouldRunAnalysis,
} from "../../src/lib/interview/delivery-metrics";
import {
  sessionKey,
  saveSession,
  loadSession,
  clearSession,
  SESSION_TTL_MS,
  type SessionStorage,
} from "../../src/lib/interview/session-persistence";

function mapStorage(seed: Record<string, string> = {}): SessionStorage {
  const m = new Map(Object.entries(seed));
  return {
    getItem: (k) => (m.has(k) ? m.get(k)! : null),
    setItem: (k, v) => void m.set(k, v),
    removeItem: (k) => void m.delete(k),
  };
}

describe("delivery-metrics (verbatim ports)", () => {
  it("counts words and WPM with the 3s floor", () => {
    expect(countWords("  hello   world ")).toBe(2);
    expect(countWords("   ")).toBe(0);
    expect(computeWpm("one two three four", 2)).toBe(2);
    expect(computeWpm("one two", 0.01)).toBeNull(); // below 0.05min floor
    expect(computeWpm("", 5)).toBe(0);
  });

  it("counts EN + ZH fillers (verbatim \\b quirk preserved, not fixed)", () => {
    // \b is ASCII-only, so CJK fillers match only adjacent to word chars —
    // identical to the page's literal regex. Port, don't improve.
    expect(countFillers("Well, um, I mean, you know, ah")).toBe(4);
    expect(countFillers("Well, um, 就是这样, you know")).toBe(2);
    expect(countFillers("clean answer, no fillers here")).toBe(0);
    expect(countFillers("")).toBe(0);
  });

  it("throttles heavy analysis exactly like the page", () => {
    const base = { nowMs: 100000, lastMs: 0, hasCodeCtx: false, hasDesignCtx: false };
    expect(shouldRunAnalysis({ ...base, textLen: 50 })).toBe(true); // >15s
    expect(shouldRunAnalysis({ ...base, nowMs: 10000, textLen: 50 })).toBe(false); // cooldown
    expect(shouldRunAnalysis({ ...base, nowMs: 10000, textLen: 5 })).toBe(false); // thin
    expect(shouldRunAnalysis({ ...base, nowMs: 16000, textLen: 5, hasCodeCtx: true })).toBe(false); // code needs 20s
    expect(shouldRunAnalysis({ ...base, nowMs: 21000, textLen: 5, hasCodeCtx: true })).toBe(true);
    expect(shouldRunAnalysis({ ...base, nowMs: 21000, textLen: 5, hasDesignCtx: true })).toBe(true);
  });
});

describe("session-persistence (verbatim ports)", () => {
  it("round-trips snapshots under the interve_session_ key", () => {
    expect(sessionKey("42")).toBe("interve_session_42");
    const s = mapStorage();
    saveSession(s, "42", { messages: [{ a: 1 }], wpm: 120, fillerWordsCount: 3 }, 1000);
    expect(s.getItem("interve_session_42")).toContain('"savedAt":1000');
    const loaded = loadSession(s, "42", 2000);
    expect(loaded).toEqual({ status: "found", snapshot: { messages: [{ a: 1 }], wpm: 120, fillerWordsCount: 3, savedAt: 1000 } });
  });

  it("expires after 30 days and removes the key", () => {
    const s = mapStorage();
    saveSession(s, "7", { messages: [{ a: 1 }], wpm: 0, fillerWordsCount: 0 }, 0);
    expect(loadSession(s, "7", SESSION_TTL_MS + 1)).toEqual({ status: "expired" });
    expect(s.getItem(sessionKey("7"))).toBeNull();
  });

  it("treats missing/garbage/empty as none (never throws)", () => {
    const s = mapStorage({ [sessionKey("g")]: "{oops", [sessionKey("e")]: JSON.stringify({ messages: [] }) });
    expect(loadSession(s, "missing", 0)).toEqual({ status: "none" });
    expect(loadSession(s, "g", 0)).toEqual({ status: "none" });
    expect(loadSession(s, "e", 0)).toEqual({ status: "none" });
    const throwing: SessionStorage = {
      getItem: () => { throw new Error("denied"); },
      setItem: () => { throw new Error("denied"); },
      removeItem: () => { throw new Error("denied"); },
    };
    expect(loadSession(throwing, "x", 0)).toEqual({ status: "none" });
    expect(() => saveSession(throwing, "x", { messages: [], wpm: 0, fillerWordsCount: 0 })).not.toThrow();
    expect(() => clearSession(throwing, "x")).not.toThrow();
  });
});
