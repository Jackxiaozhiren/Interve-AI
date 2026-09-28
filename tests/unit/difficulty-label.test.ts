// The loop badge used to build its label by capitalising the difficulty into an
// i18n key name and then a four-way ternary:
//
//   const diffKey = `difficulty${difficulty[0].toUpperCase()}${difficulty.slice(1)}`
//   diffKey === "difficultyEasy" ? … : diffKey === "difficultyMedium" ? … : …
//
// That works only while the strings happen to line up, and its `else` arm silently
// renders Expert for any value that is neither easy/medium/hard — which is
// unreachable today only because useInterviewLoopStore.ts:32-34 normalises against
// DIFFICULTIES. Moved out of src/app/interview/page.tsx so the mapping is a
// function with a name, testable without React or a dictionary provider.
import { describe, it, expect } from "vitest";
import { difficultyLabel, loopBadge } from "../../src/lib/interview/difficulty-label";

const t = {
  interview: {
    turn: "Turn",
    difficultyEasy: "Easy",
    difficultyMedium: "Medium",
    difficultyHard: "Hard",
    difficultyExpert: "Expert",
  },
} as const;

describe("difficultyLabel", () => {
  it("maps the four known levels", () => {
    expect(difficultyLabel(t, "easy")).toBe("Easy");
    expect(difficultyLabel(t, "medium")).toBe("Medium");
    expect(difficultyLabel(t, "hard")).toBe("Hard");
    expect(difficultyLabel(t, "expert")).toBe("Expert");
  });

  it("renders Expert for an unnormalised level, exactly as the old else-arm did", () => {
    expect(difficultyLabel(t, "banana")).toBe("Expert");
  });

  // NOT behaviour-preserving, and labelled as such: the inline version did
  // `s.loop.difficulty[0].toUpperCase()`, which throws a TypeError when the
  // difficulty is missing. Unreachable today only because the store normalises,
  // so this turns a latent crash into the same Expert fallback everything else
  // already renders. The other two arms above are exact.
  it("does not throw on an absent difficulty, unlike the code it replaces", () => {
    expect(() => difficultyLabel(t, undefined)).not.toThrow();
    expect(difficultyLabel(t, undefined)).toBe("Expert");
  });

  it("uses the supplied dictionary, so Chinese strings come through", () => {
    const zh = { ...t, interview: { ...t.interview, difficultyHard: "困难" } };
    expect(difficultyLabel(zh, "hard")).toBe("困难");
  });
});

describe("loopBadge", () => {
  it("is turn, count and level in the existing separator style", () => {
    expect(loopBadge(t, 3, "hard")).toBe("Turn 3 · Hard");
  });

  it("survives an absent difficulty the same way the component did", () => {
    expect(loopBadge(t, 1, undefined)).toBe("Turn 1 · Expert");
  });
});
