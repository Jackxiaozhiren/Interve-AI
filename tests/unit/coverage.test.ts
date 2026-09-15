// Phase 6: coverage prompt section tests.
import { describe, it, expect } from "vitest";
import { buildCoverageSection, COVERAGE_PROMPT_ID, COVERAGE_PROMPT_VERSION } from "../../src/ai/prompts/coverage";
import { initInterviewState, recordTurn } from "../../src/ai/interview/state";

describe("buildCoverageSection", () => {
  it("renders turns, difficulty, budget, gaps, and recent questions", () => {
    let s = initInterviewState({ level: "Mid-Level", now: 0 });
    s = recordTurn(s, {
      question: "Tell me about a production incident you handled end to end.",
      starProgress: { s: { progress: 80 }, t: { progress: 80 }, a: { progress: 80 }, r: { progress: 20 } },
      behavioralTraits: { leadership: 30, problemSolving: 80, communication: 80 },
    });
    const out = buildCoverageSection(s, 60_000);
    expect(out).toContain("turn 1");
    expect(out).toContain("Medium");
    expect(out).toContain("STAR-Result thin (20%)");
    expect(out).toContain("Leadership weak (30)");
    expect(out).toContain("production incident");
    expect(out).toContain("may lag one turn");
  });

  it("shows the advancing line when clean and the wrap-up line when late", () => {
    const clean = initInterviewState({ now: 0 });
    expect(buildCoverageSection(clean, 1000)).toContain("advance the interview plan");
    const late = { ...clean, turnCount: 12 };
    expect(buildCoverageSection(late, 800_000)).toContain("wrap up");
  });

  it("is versioned", () => {
    expect(COVERAGE_PROMPT_ID).toBe("interview-coverage");
    expect(COVERAGE_PROMPT_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
  });
});
