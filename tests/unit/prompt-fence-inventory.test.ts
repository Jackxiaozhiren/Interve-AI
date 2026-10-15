/**
 * Prompt-injection fences, pinned to the registry instead of to a list.
 *
 * `src/ai/prompts/*` hardened every builder that splices candidate-controlled
 * text into a prompt (resume, JD, transcript, answer, code) so the model reads
 * it as data. The guard for that was a hand-written sequence of `expect(...)`
 * calls naming the builders that existed when it was written. A rule like that
 * cannot fail in the way it matters: adding one more prompt to
 * `PROMPT_REGISTRY` and feeding it raw candidate text leaves every existing
 * assertion untouched — the list stays green because it is still the list.
 *
 * So this file enumerates from the registry and asks one question per id: does
 * this lane receive content a candidate controls? The answer is mandatory
 * either way, which is what turns an inventory into a check:
 *
 *   - `FENCED` — the builder is called with a sentinel, and the sentinel has to
 *     come out **between** an `UNTRUSTED … START` and its matching `END`.
 *     Containment, not presence: a prompt that merely says the word UNTRUSTED
 *     while interpolating the value outside any fence would satisfy a
 *     `toContain("UNTRUSTED")` assertion, and that is precisely the reading this
 *     replaces. Fence pairs also have to balance, because an unclosed section
 *     ends wherever the injected text says it does.
 *   - `NO_CANDIDATE_INPUT` — the lane takes nothing a candidate wrote, and the
 *     claim is checkable rather than asserted: arity for the OCR instruction,
 *     and a source-level ban on the field names that carry candidate text for
 *     the coverage section. Either check reddens the moment the classification
 *     stops being true, which is when the fence question has to be re-answered.
 *
 * Witnessed by FEN1 (a builder's fence pair removed) and FEN2 (a registry id
 * that nobody classified) — see scripts/falsify/plants.json.
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { PROMPT_REGISTRY } from "../../src/ai/prompts";
import { buildInterviewSystemPrompt } from "../../src/ai/prompts/interview";
import { buildStarPrompt, buildStarSystem } from "../../src/ai/prompts/star";
import { buildBehaviorPrompt, buildBehaviorSystem } from "../../src/ai/prompts/behavior";
import { buildChunkPrompt, buildChunkSystem } from "../../src/ai/prompts/chunk";
import { buildCodePrompt } from "../../src/ai/prompts/code";
import { buildPracticePrompt, buildPracticeSystem } from "../../src/ai/prompts/practice";
import { buildAlignmentPrompt } from "../../src/ai/prompts/alignment";
import { buildMatchPrompt } from "../../src/ai/prompts/match";
import { buildJdPrompt, buildJdSystem } from "../../src/ai/prompts/jd";
import { buildContextPrompt, buildContextSystem } from "../../src/ai/prompts/context";
import { buildCopilotSystem } from "../../src/ai/prompts/copilot";
import { buildHintPrompt, buildHintSystem } from "../../src/ai/prompts/hint";
import { buildVisionText } from "../../src/ai/prompts/vision";
import { buildTrendsPrompt } from "../../src/ai/prompts/trends";
import { buildOcrInstruction } from "../../src/ai/prompts/resume";
import { buildCoverageSection } from "../../src/ai/prompts/coverage";
import { buildEvaluationUserPrompt } from "../../src/ai/prompts/evaluation";

/** Distinctive enough that no legitimate prompt text contains it. */
const SENTINEL = "SENTINEL-CANDIDATE-TEXT-9f3c";

/**
 * Registry id -> every string that lane sends to the model, built from inputs a
 * candidate controls. A lane lists both messages wherever a system prompt
 * exists, so the enclosure check runs against the message the payload actually
 * travels in and an unfenced system prompt is not mistaken for a hole.
 */
const FENCED: Record<string, () => string[]> = {
  "interview-system": () => [
    buildInterviewSystemPrompt({ role: "R", level: "L", persona: "professional", context: SENTINEL }),
  ],
  "analyze-star": () => [buildStarSystem(), buildStarPrompt({ transcript: SENTINEL })],
  "analyze-behavior": () => [buildBehaviorSystem(), buildBehaviorPrompt(SENTINEL)],
  "analyze-chunk": () => [buildChunkSystem({ role: "R", level: "L" }), buildChunkPrompt(SENTINEL)],
  "analyze-code": () => [buildCodePrompt({ code: SENTINEL, language: "ts", problemStatement: "P" })],
  "analyze-practice": () => [buildPracticeSystem(), buildPracticePrompt({ title: "T", answer: SENTINEL })],
  "analyze-alignment": () => [buildAlignmentPrompt({ resumeText: SENTINEL, jobDescription: "J" })],
  "analyze-match": () => [buildMatchPrompt({ resumeText: SENTINEL, jobDescription: "J" })],
  "parse-jd": () => [buildJdSystem({ jobDescription: SENTINEL, questionCount: 3 }), buildJdPrompt(SENTINEL)],
  "init-context": () => [buildContextSystem(), buildContextPrompt({ jobDescription: "J", resumeContext: SENTINEL })],
  copilot: () => [buildCopilotSystem({ question: "Q", resumeSnippets: [SENTINEL] })],
  "generate-hint": () => [buildHintSystem({ currentCode: SENTINEL }), buildHintPrompt(SENTINEL)],
  "analyze-vision": () => [buildVisionText({ problemContext: SENTINEL })],
  "analyze-trends": () => [buildTrendsPrompt(3, SENTINEL)],
  "evaluation-v2": () => [buildEvaluationUserPrompt([{ role: "user", content: SENTINEL }])],
};

/**
 * Lanes that receive nothing a candidate wrote. Keyed by registry id; each
 * entry's claim is re-checked below rather than trusted.
 */
const NO_CANDIDATE_INPUT: Record<string, string> = {
  "parse-resume": "buildOcrInstruction() has no parameters, so it can only ever be a constant",
  "interview-coverage": "buildCoverageSection(state) renders server-synthesized state, not candidate prose",
};

/** Identifiers whose values ARE candidate prose, used to police the exemptions. */
const CANDIDATE_FIELDS = /resumeText|jobDescription|transcript|answerText|\banswer\b|lastAnswer|chunkText/;

const ids = PROMPT_REGISTRY.map((p) => p.id);

describe("every registered prompt is classified for injection fences", () => {
  it("classifies each registry id and no leftovers (enumeration is the point)", () => {
    const classified = [...Object.keys(FENCED), ...Object.keys(NO_CANDIDATE_INPUT)].sort();
    expect(
      classified,
      "PROMPT_REGISTRY and the fence inventory disagree: a lane was added or renamed without " +
        "deciding whether it carries candidate text"
    ).toEqual([...ids].sort());
  });

  it("classifies most lanes as carrying candidate text, so the loop below is not vacuous", () => {
    // An empty FENCED map would satisfy the enumeration by declaring everything
    // safe. This floor is what stops that reading.
    expect(Object.keys(FENCED).length).toBeGreaterThanOrEqual(14);
  });

  for (const [id, build] of Object.entries(FENCED)) {
    it(`keeps ${id}'s candidate text inside an UNTRUSTED fence`, () => {
      const parts = build();
      const carriers = parts.filter((p) => p.includes(SENTINEL));
      expect(
        carriers.length,
        "classified as fenced, but no message carries the candidate input: the sentinel never " +
          "reached the model text this entry claims to protect"
      ).toBeGreaterThan(0);
      for (const text of carriers) {
        const at = text.indexOf(SENTINEL);
        expect(
          /UNTRUSTED [A-Z ]*START/.test(text.slice(0, at)),
          `${id}: candidate text with no fence opening before it`
        ).toBe(true);
        expect(
          /UNTRUSTED [A-Z ]*END/.test(text.slice(at + SENTINEL.length)),
          `${id}: candidate text with no fence closing after it`
        ).toBe(true);
      }
    });

    it(`balances ${id}'s fence pairs`, () => {
      const text = build().join("\n");
      const starts = (text.match(/UNTRUSTED [A-Z ]*START/g) ?? []).length;
      const ends = (text.match(/UNTRUSTED [A-Z ]*END/g) ?? []).length;
      expect(starts, `${id}: no fence pair at all`).toBeGreaterThan(0);
      expect(ends, `${id}: ${starts} START but ${ends} END — an unclosed section ends where the ` +
        "injected text says it does").toBe(starts);
    });
  }

  it("keeps each exemption true instead of merely stated", () => {
    expect(
      buildOcrInstruction.length,
      "parse-resume's builder now takes an argument: re-ask whether it carries candidate text"
    ).toBe(0);

    const coverage = readFileSync(
      new URL("../../src/ai/prompts/coverage.ts", import.meta.url),
      "utf8"
    )
      // Comments are prose about the code, not the code: a sentence explaining
      // "no candidate answer reaches this text" must not read as a field access.
      .replace(/\/\*[\s\S]*?\*\//g, " ")
      .replace(/^\s*\/\/.*$/gm, " ");
    expect(
      coverage,
      "the coverage section now reads a candidate-authored field; it belongs in FENCED with a " +
        "fence pair, not in the exemption list"
    ).not.toMatch(CANDIDATE_FIELDS);
  });
});
