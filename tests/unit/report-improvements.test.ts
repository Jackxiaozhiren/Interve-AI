import { describe, expect, it } from "vitest";
import { locateQuote, quoteFragment, topImprovements, type TranscriptTurn } from "@/lib/report-improvements";
import type { EvaluationView, DimensionView } from "@/lib/eval-compat";

/**
 * P0-2's derivation. The report may only claim a round number it can support,
 * because the reader clicks it and lands on the words — a citation that points
 * at the wrong turn is worse than one that admits it cannot place the quote.
 */

const turn = (id: string, role: string, content: string): TranscriptTurn => ({ id, role, content });

const transcript: TranscriptTurn[] = [
  turn("a1", "assistant", "先做个自我介绍吧。"),
  turn("u1", "user", "我有三年 React 经验，做过中后台系统。"),
  turn("a2", "assistant", "那次性能优化带来多少提升？"),
  turn("u2", "user", "我们大概快了一点点，具体没测。"),
  turn("u3", "user", "我负责了那个项目的前端部分。"),
];

const dim = (over: Partial<DimensionView> & { id: string }): DimensionView => ({
  name: over.id,
  score100: 60,
  anchorLevel: 3,
  evidence: [],
  rationale: "r",
  confidence: "high",
  improvement: "i",
  ...over,
});

const view = (dimensions: DimensionView[]): EvaluationView => ({
  kind: "v2",
  legacy: false,
  rubricId: "general-v1",
  readinessLabel: "developing",
  readinessRationale: "x",
  average: 60,
  confidence: "high",
  dimensions,
  strengths: [],
  weaknesses: [],
  nextDrills: [],
  disclaimer: null,
});

describe("locateQuote", () => {
  it("numbers rounds by the candidate's turns, not the transcript's", () => {
    // u2 is the fourth message but the second answer.
    expect(locateQuote("我们大概快了一点点", transcript)).toEqual({ round: 2, messageId: "u2" });
    expect(locateQuote("我有三年 React 经验", transcript)).toEqual({ round: 1, messageId: "u1" });
  });

  it("survives the punctuation and spacing a model adds around a quote", () => {
    expect(locateQuote("“我们大概快了一点点，具体没测。”", transcript)?.round).toBe(2);
    expect(locateQuote("我负责了 那个项目 的前端部分", transcript)?.round).toBe(3);
  });

  it("places a quote that swallowed the whole answer", () => {
    const quote = "候选人说：我们大概快了一点点，具体没测。";
    expect(locateQuote(quote, transcript)).toEqual({ round: 2, messageId: "u2" });
  });

  it("refuses to place a paraphrase the transcript never said", () => {
    expect(locateQuote("面试里提到的那个性能数字", transcript)).toBeNull();
  });

  it("will not treat a two-character acknowledgement as the source of a long quote", () => {
    const short: TranscriptTurn[] = [turn("u1", "user", "嗯"), turn("u2", "user", "我们大概快了一点点，具体没测。")];
    // "嗯" is contained in almost nothing, but the reverse test ("the answer sits
    // inside the quote") would match it — which is why that direction has a floor.
    expect(locateQuote("嗯，性能提升大概是百分之六十左右", short)).toBeNull();
  });

  it("returns null for a quote too short to identify anything", () => {
    expect(locateQuote("好", transcript)).toBeNull();
  });
});

describe("topImprovements", () => {
  it("takes the weakest three, with their own sentence and their own quote", () => {
    const items = topImprovements(
      view([
        dim({ id: "ownership", score100: 80, evidence: ["我负责了那个项目的前端部分"], improvement: "说清那个决定。" }),
        dim({ id: "specificity", score100: 40, evidence: ["我们大概快了一点点"], improvement: "把结果量化成一个数字。" }),
        dim({ id: "star", score100: 60, evidence: ["我有三年 React 经验"], improvement: "补上 Result。" }),
        dim({ id: "impact", score100: 100, evidence: ["我有三年 React 经验"], improvement: "不该出现在首屏。" }),
      ]),
      transcript,
    );

    expect(items.map((i) => i.dimensionId)).toEqual(["specificity", "star", "ownership"]);
    expect(items[0]).toMatchObject({ sentence: "把结果量化成一个数字。", quote: "我们大概快了一点点", round: 2 });
    expect(items[1].round).toBe(1);
  });

  it("drops a dimension it cannot cite rather than showing it bare", () => {
    const items = topImprovements(
      view([
        dim({ id: "noevidence", score100: 10, evidence: [], improvement: "无证据的建议。" }),
        dim({ id: "cited", score100: 90, evidence: ["我们大概快了一点点"], improvement: "有证据的建议。" }),
      ]),
      transcript,
    );
    // The block must never open with "change this" and no quote behind it.
    expect(items.map((i) => i.dimensionId)).toEqual(["cited"]);
  });

  it("renders a quote whose round cannot be established, with no round number", () => {
    const items = topImprovements(
      view([dim({ id: "d", score100: 20, evidence: ["面试里提到的那个性能数字"], improvement: "把影响说给非技术听众。" })]),
      transcript,
    );
    expect(items).toHaveLength(1);
    expect(items[0].round).toBeNull();
    expect(items[0].messageId).toBeNull();
    expect(items[0].quote).toBe("面试里提到的那个性能数字");
  });

  it("is empty for a legacy row, whose dimensions carry no evidence", () => {
    const legacy: EvaluationView = { ...view([]), kind: "legacy", legacy: true };
    expect(topImprovements(legacy, transcript)).toEqual([]);
  });

  it("never returns more than three", () => {
    const six = Array.from({ length: 6 }, (_, i) =>
      dim({ id: `d${i}`, score100: 10 + i, evidence: ["我们大概快了一点点"], improvement: `i${i}` }),
    );
    expect(topImprovements(view(six), transcript)).toHaveLength(3);
  });

  it("cuts a production-scale quote to a fragment, and still places its round", () => {
    // Measured on a real session (2026-11-02): GLM wrote a 138-character evidence
    // sentence and the card printed it whole. The block is a first screen, not a wall.
    const long =
      "那次优化我们主要做了路由懒加载和组件拆分，整体来说页面渲染的速度大概是快了一点点，具体没有做很精确的测量，但是从用户反馈来看体验是有提升的。";
    const local: TranscriptTurn[] = [...transcript, turn("u4", "user", long)];
    const items = topImprovements(
      view([dim({ id: "d", score100: 20, evidence: [long], improvement: "把结果量化成一个数字。" })]),
      local,
    );
    expect(items[0].quote).toBe(long);
    expect(items[0].fragment).not.toBe(long);
    expect(items[0].fragment.endsWith("…")).toBe(true);
    expect(items[0].fragment.length).toBeLessThanOrEqual(41); // 40 chars + ellipsis
    expect(items[0].round).toBe(4);
  });

  it("keeps a short quote whole — a fragment of a fragment serves nobody", () => {
    const items = topImprovements(
      view([dim({ id: "d", score100: 20, evidence: ["我们大概快了一点点"], improvement: "量化。" })]),
      transcript,
    );
    expect(items[0].fragment).toBe("我们大概快了一点点");
    expect(items[0].fragment.endsWith("…")).toBe(false);
  });

  it("marks a sentence an earlier item already cited, instead of printing it again", () => {
    // The measured bug: three dimensions, one evidence sentence, printed three times.
    const items = topImprovements(
      view([
        dim({ id: "d0", score100: 20, evidence: ["我们大概快了一点点"], improvement: "第一件。" }),
        dim({ id: "d1", score100: 30, evidence: ["我们大概快了一点点"], improvement: "第二件。" }),
        dim({ id: "d2", score100: 40, evidence: ["我负责了那个项目的前端部分"], improvement: "第三件。" }),
      ]),
      transcript,
    );
    expect(items[0].repeatOf).toBeNull();
    expect(items[1].repeatOf).toBe(1);
    expect(items[2].repeatOf).toBeNull();
  });

  it("detects a repeat even when neither copy can be placed in the transcript", () => {
    const items = topImprovements(
      view([
        dim({ id: "d0", score100: 20, evidence: ["面试里提到的那个性能数字"], improvement: "第一件。" }),
        dim({ id: "d1", score100: 30, evidence: ["“面试里提到的那个 性能数字。”"], improvement: "第二件。" }),
      ]),
      transcript,
    );
    // Same words after stripping whitespace, quotes and punctuation, same round
    // of "the reader has seen it".
    expect(items[0].repeatOf).toBeNull();
    expect(items[1].repeatOf).toBe(1);
  });
});

describe("quoteFragment", () => {
  it("cuts at a clause boundary near the limit, not mid-word", () => {
    const quote =
      "第一句话很短。第二句话要长得多，一直延伸到超过六十个字的限制，中间还有很多很多的细节描述，把来龙去脉讲了一遍，最后还有一个收尾的总结。";
    const frag = quoteFragment(quote);
    expect(frag.endsWith("…")).toBe(true);
    expect(frag.length).toBeLessThanOrEqual(41);
    // The cut lands after a break character, so the fragment reads like speech.
    expect(/[，。；、！？,.;!?]…$/.test(frag) || frag.length <= 41).toBe(true);
  });

  it("falls back to a hard cut when no clause boundary sits near the limit", () => {
    const quote =
      "这是一个完全没有标点的很长很长很长很长很长很长很长很长很长很长很长很长很长很长很长很长很长很长很长的句子没有停顿一路说到最后";
    const frag = quoteFragment(quote);
    expect(frag.endsWith("…")).toBe(true);
    expect(frag.length).toBeLessThanOrEqual(41);
  });

  it("never cuts a quote that already fits", () => {
    expect(quoteFragment("我们大概快了一点点")).toBe("我们大概快了一点点");
  });
});
