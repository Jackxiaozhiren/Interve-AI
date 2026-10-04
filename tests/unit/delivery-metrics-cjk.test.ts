/**
 * The interview room runs with `recognition.lang = 'zh-CN'` and a Chinese UI,
 * but both live delivery metrics were shaped for English only:
 *
 * - `countWords` split on whitespace, so a 41-character Chinese answer counted
 *   as ONE word. `computeWpm` therefore reported ~1 for fluent speech, and two
 *   consumers branch on that number: the report page tells every Chinese
 *   candidate their pacing is "below the 100-160 reference band", and
 *   CopilotHints repeats "your pacing is a bit slow" every 3 seconds while
 *   they are speaking.
 * - `FILLER_PATTERN` wrapped its Chinese entries in `\b`, and `\w` is ASCII-only
 *   in JavaScript, so no Chinese filler could ever match: 嗯 / 啊 / 额 / 那个 /
 *   就是 / 然后 all counted 0. The hesitation signal was dead for the primary
 *   language, which also starved the cognitive-load bump keyed off it.
 *
 * These cases pin the corrected behaviour. The English assertions are unchanged
 * on purpose — the existing suite covered only English, which is exactly how
 * both defects survived.
 */
import { describe, expect, it } from "vitest";
import { countFillers, countWords, computeWpm } from "@/lib/interview/delivery-metrics";

describe("Chinese pacing", () => {
  const answer = "嗯，我觉得那个项目里，我主要负责后端服务的拆分和性能优化，然后我们把延迟降了四成。";

  it("counts Chinese characters as words", () => {
    // Measured, not assumed: 41 code points, of which 37 are Han and 4 are
    // full-width punctuation.
    expect(countWords(answer)).toBe(37);
  });

  it("reports a pacing figure that tracks real speech, not a constant 1", () => {
    // computeWpm's second argument is MINUTES (minMinutes defaults to 0.05 ≈ 3s).
    expect(computeWpm(answer, 1)).toBe(37);
    expect(computeWpm(answer, 0.25)).toBe(148);
  });

  it("leaves English counting alone", () => {
    expect(countWords("I led the backend split and cut latency")).toBe(8);
    expect(computeWpm("one two three four five six seven eight nine ten", 0.5)).toBe(20);
  });

  it("counts mixed-language text by both scripts", () => {
    // "I 做了 two 三" → 2 latin words + 3 Han characters. The broken
    // whitespace split also returned 4 here, but by coincidence: it counted the
    // run 做了 as a single word and missed a character.
    expect(countWords("I 做了 two 三")).toBe(5);
  });

  it("treats punctuation and spaces as separators, not words", () => {
    expect(countWords("   ")).toBe(0);
    expect(countWords("，。！？")).toBe(0);
    expect(countWords("")).toBe(0);
  });
});

describe("Chinese fillers", () => {
  it("counts a standalone interjection", () => {
    expect(countFillers("嗯，我觉得吧")).toBe(1);
    expect(countFillers("那个 那个 我试试")).toBe(2);
    expect(countFillers("额…这个")).toBe(1);
  });

  it("does not count a particle glued to the word before it", () => {
    // 好啊 / 对啊 are natural sentence endings, not hesitation.
    expect(countFillers("这个好啊")).toBe(0);
    expect(countFillers("对啊没问题")).toBe(0);
  });

  it("does not count a connector running into its clause", () => {
    // 然后/就是 are ordinary narrative connectors in Chinese; requiring a
    // standalone token keeps them out of the hesitation count instead of
    // inflating it for every fluent sentence.
    expect(countFillers("然后我们就开始做了")).toBe(0);
    expect(countFillers("就是这样的")).toBe(0);
  });

  it("still counts English fillers as before", () => {
    expect(countFillers("Well, um, I mean, you know, ah")).toBe(4);
  });

  it("counts both scripts in one utterance", () => {
    expect(countFillers("um 嗯 uh")).toBe(3);
  });

  it("returns 0 for text with no hesitation markers at all", () => {
    expect(countFillers("我把服务拆成六个模块，P99 延迟下降四成")).toBe(0);
  });
});
