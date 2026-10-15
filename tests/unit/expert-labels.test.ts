/**
 * The persona label is a contract between two files, and it used to be checked by
 * neither.
 *
 * `src/ai/prompts/interview.ts` tells the model to open every reply with
 * `[Tech]`, `[HR]` or `[Product]`; the interview room reads that label to decide
 * which persona is lit. Both ends are string literals, so either can change
 * alone: a reworded prompt leaves the room stuck on whoever spoke last, and a
 * typo in the room's matcher silently retires a persona. Nothing in the suite
 * compared the two — `ai-registry` only asserts the prompt mentions `[Tech]`
 * somewhere, and `tests/chat.spec.ts` asserts the mock reply's text.
 *
 * `src/lib/interview/experts.ts` now holds the mapping, which makes it both
 * unit-testable and comparable against the prompt's own instruction.
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { LABEL_TO_EXPERT, expertFromMessage } from "../../src/lib/interview/experts";

const PROMPT = "src/ai/prompts/interview.ts";
const promptText = readFileSync(new URL(`../../${PROMPT}`, import.meta.url), "utf8");

/** Bracketed words the prompt uses, e.g. `[Tech]`. Deliberately permissive. */
function promptLabels(): string[] {
  return [...new Set([...promptText.matchAll(/\[([A-Z][A-Za-z]*)\]/g)].map((m) => `[${m[1]}]`))].sort();
}

describe("the room reads the persona the prompt promises", () => {
  it("maps each label to its persona, and nothing else to anything", () => {
    expect(expertFromMessage("[Tech] 你的架构里如果有单点故障怎么办？")).toBe("tech");
    expect(expertFromMessage("[HR] 讲一次你和同事的冲突。")).toBe("hr");
    expect(expertFromMessage("[Product] 你怎么排需求优先级？")).toBe("product");
    // No label, or an unknown one: the caller keeps the current persona, which is
    // what the page's `if (announced)` guard depends on.
    expect(expertFromMessage("Let us start with your background.")).toBeNull();
    expect(expertFromMessage("[Legal] Tell me about NDAs.")).toBeNull();
    expect(expertFromMessage("")).toBeNull();
    // Only a leading label counts — a mention mid-sentence is not a turn taking.
    expect(expertFromMessage("As [Tech] said earlier")).toBeNull();
  });

  it("labels every persona the room can light except the standby default", () => {
    expect(Object.values(LABEL_TO_EXPERT).sort()).toEqual(["hr", "product", "tech"]);
  });

  it("recognises exactly the labels the prompt instructs the model to emit", () => {
    const fromPrompt = promptLabels();
    expect(fromPrompt.length, `${PROMPT} yielded no bracketed labels — did its shape change?`).toBeGreaterThanOrEqual(3);
    expect(
      fromPrompt,
      "the prompt and the room disagree about which labels announce a persona"
    ).toEqual(Object.keys(LABEL_TO_EXPERT).sort());
  });
});
