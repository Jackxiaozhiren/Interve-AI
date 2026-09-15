// Phase 6: interview loop state unit tests.
import { describe, it, expect } from "vitest";
import {
  levelToDifficulty,
  deriveFollowUpTargets,
  adaptDifficulty,
  initInterviewState,
  recordTurn,
  remainingSec,
  synthesizeServerState,
  DEFAULT_TIME_BUDGET_SEC,
} from "../../src/ai/interview/state";

describe("levelToDifficulty", () => {
  it("maps seniority to starting difficulty", () => {
    expect(levelToDifficulty("Intern")).toBe("easy");
    expect(levelToDifficulty("Junior")).toBe("easy");
    expect(levelToDifficulty("Mid-Level")).toBe("medium");
    expect(levelToDifficulty("Senior")).toBe("hard");
    expect(levelToDifficulty("Staff/Principal")).toBe("hard");
    expect(levelToDifficulty(undefined)).toBe("medium");
    expect(levelToDifficulty("")).toBe("medium");
  });
});

describe("deriveFollowUpTargets", () => {
  it("flags thin STAR components and weak traits with documented thresholds", () => {
    const t = deriveFollowUpTargets(
      { s: { progress: 30 }, t: { progress: 80 }, a: { progress: 49 }, r: { progress: 90 } },
      { leadership: 20, problemSolving: 90, communication: 90 }
    );
    expect(t).toContain("STAR-Situation thin (30%)");
    expect(t).toContain("STAR-Action thin (49%)");
    expect(t).toContain("Leadership weak (20)");
    expect(t).not.toContain(expect.stringContaining("Task"));
  });

  it("returns empty when everything is covered, caps at 5", () => {
    expect(
      deriveFollowUpTargets(
        { s: { progress: 90 }, t: { progress: 90 }, a: { progress: 90 }, r: { progress: 90 } },
        { leadership: 90, problemSolving: 90, communication: 90 }
      )
    ).toEqual([]);
  });
});

describe("adaptDifficulty", () => {
  it("holds before 2 turns (insufficient evidence)", () => {
    expect(adaptDifficulty("medium", { starAvg: 95, traitsAvg: 95, turnCount: 1 })).toBe("medium");
  });

  it("holds without signals", () => {
    expect(adaptDifficulty("medium", { starAvg: null, traitsAvg: null, turnCount: 5 })).toBe("medium");
  });

  it("steps up at >=75 and down below 40, one step max", () => {
    expect(adaptDifficulty("medium", { starAvg: 80, traitsAvg: 80, turnCount: 3 })).toBe("hard");
    expect(adaptDifficulty("medium", { starAvg: 20, traitsAvg: 30, turnCount: 3 })).toBe("easy");
    expect(adaptDifficulty("medium", { starAvg: 60, traitsAvg: 60, turnCount: 3 })).toBe("medium");
    expect(adaptDifficulty("expert", { starAvg: 99, traitsAvg: 99, turnCount: 9 })).toBe("expert");
    expect(adaptDifficulty("easy", { starAvg: 0, traitsAvg: 0, turnCount: 9 })).toBe("easy");
  });

  it("uses whichever signal exists", () => {
    expect(adaptDifficulty("medium", { starAvg: null, traitsAvg: 90, turnCount: 4 })).toBe("hard");
  });
});

describe("recordTurn", () => {
  it("increments, caps history, derives coverage", () => {
    let s = initInterviewState({ level: "Mid-Level", now: 1000 });
    expect(s.difficulty).toBe("medium");
    expect(s.turnCount).toBe(0);
    s = recordTurn(s, {
      question: "Tell me about a conflict.",
      starProgress: { s: { progress: 80 }, t: { progress: 80 }, a: { progress: 80 }, r: { progress: 80 } },
      behavioralTraits: { leadership: 80, problemSolving: 80, communication: 80 },
    });
    expect(s.turnCount).toBe(1);
    expect(s.questionHistory).toHaveLength(1);
    expect(s.starAvg).toBe(80);
    // turn<2: difficulty holds despite strong signals
    expect(s.difficulty).toBe("medium");
  });
});

describe("remainingSec", () => {
  it("counts down against the budget and floors at 0", () => {
    expect(remainingSec({ startedAt: 0, timeBudgetSec: DEFAULT_TIME_BUDGET_SEC }, 60_000)).toBe(840);
    expect(remainingSec({ startedAt: 0, timeBudgetSec: 60 }, 3600_000)).toBe(0);
  });
});

describe("synthesizeServerState", () => {
  const msgs = [
    { role: "assistant", content: "Q1: tell me about yourself in detail please" },
    { role: "user", content: "I am an engineer" },
    { role: "assistant", content: "Q2: conflict story?" },
    { role: "user", content: "We disagreed" },
  ];

  it("derives turns/questions from messages, adapts from hint", () => {
    const s = synthesizeServerState({
      messages: msgs,
      level: "Mid-Level",
      starProgress: { s: { progress: 90 }, t: { progress: 90 }, a: { progress: 90 }, r: { progress: 90 } },
      behavioralTraits: { leadership: 90, problemSolving: 90, communication: 90 },
      difficultyHint: "medium",
    });
    expect(s.turnCount).toBe(2);
    expect(s.questionHistory).toHaveLength(2);
    expect(s.difficulty).toBe("hard"); // strong signals + 2 turns: one step up
    expect(s.followUpTargets).toEqual([]);
  });

  it("falls back to seniority default on bogus hints", () => {
    const s = synthesizeServerState({ messages: msgs, level: "Senior", difficultyHint: "ultra" });
    expect(s.difficulty).toBe("hard");
  });

  it("handles empty histories", () => {
    const s = synthesizeServerState({ messages: [], level: "Junior" });
    expect(s.turnCount).toBe(0);
    expect(s.difficulty).toBe("easy");
    expect(s.questionHistory).toEqual([]);
  });
});
