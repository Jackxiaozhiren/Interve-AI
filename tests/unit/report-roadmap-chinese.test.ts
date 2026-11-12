/**
 * "What do I do next" is the candidate's first question, and the only section
 * of the report written AT them rather than about them.
 *
 * Three things had to be true at once and only one was: the schema carried
 * `trainingRoadmap`, the mock filled it (in English), and the evaluation prompt
 * never asked the model for it at all — so real rows had no roadmap and the
 * mock lane rendered three English noun phrases. The section therefore looked
 * present in CI and absent in production.
 *
 * These arms pin the whole chain: the prompt must request the field in the
 * output shape and demand Simplified Chinese advice sentences; the mock must
 * demonstrate the shape it asks for; the export must put the section above the
 * rubric; and the page must render Chinese headings, not the English ones.
 */
import { describe, expect, it } from "vitest";
import { readRepo } from "./repo-tree";
import { buildEvaluationSystemPrompt, buildEvaluationUserPrompt } from "../../src/ai/prompts/evaluation";
import { mockV2Evaluation } from "../../src/ai/providers/mock";
import { exportInterviewToMarkdown } from "../../src/lib/utils/export";
import type { Interview } from "../../src/lib/db";
import type { Rubric } from "../../src/ai/rubrics";

const rubric: Rubric = {
  id: "test-v1",
  version: "1.0.0",
  track: "behavioral",
  trackZh: "行为面试",
  dimensions: [
    {
      id: "depth",
      name: "Depth",
      nameZh: "深度",
      guidance: "How far the answer goes below the surface.",
      anchors: [
        { level: 1, label: "Absent", description: "No detail." },
        { level: 2, label: "Emerging", description: "Names a tool." },
        { level: 3, label: "Proficient", description: "Explains the choice." },
        { level: 4, label: "Strong", description: "Weighs trade-offs." },
        { level: 5, label: "Exemplary", description: "Anticipates failure modes." },
      ],
    },
  ],
};

/** A complete V2 row: the export reads the same fallback the page does. */
const v2Interview = {
  id: 1,
  title: "后端工程师模拟面试",
  status: "completed",
  createdAt: new Date("2026-11-11T00:00:00Z"),
  updatedAt: new Date("2026-11-11T00:00:00Z"),
  evaluationV2: {
    version: "2.0",
    rubricId: rubric.id,
    readiness: "developing",
    readinessRationale: "两个维度有证据，深度不足。",
    dimensions: [
      {
        id: "depth",
        score: 3,
        evidence: ["我用 Redis 做了缓存"],
        rationale: "有实现细节，但缺少取舍。",
        confidence: "medium",
        improvement: "先说取舍再写代码。",
      },
    ],
    strengths: ["表达清晰"],
    weaknesses: ["深度不足"],
    nextDrills: ["练习讲取舍"],
    qaReview: [],
    trainingRoadmap: {
      technical: ["建议先讲取舍再写代码，因为你的实现细节完整，但没说为什么这样选。"],
      behavioral: ["建议给结果补上可量化的影响，因为目前只说了做了什么。"],
      resources: ["建议重读「深度」一档的描述，因为追问停留在概念层面。"],
    },
  },
} as unknown as Interview;

const zhAdvice = /建议.+，因为/;

describe("the evaluation prompt asks for a Chinese roadmap", () => {
  it("names trainingRoadmap in the output shape", () => {
    const user = buildEvaluationUserPrompt(
      [{ role: "user", content: "I used Redis for caching." }],
      undefined,
      rubric
    );
    // The skeleton, not the prose: SHAPE RULES also names the field, so a
    // `toContain('"trainingRoadmap"')` assertion stays green after the JSON
    // block loses it — which is exactly the defect this arm exists to catch.
    expect(
      user,
      "the output shape dropped trainingRoadmap: real evaluations would silently carry no roadmap again"
    ).toContain('"trainingRoadmap": {"technical"');
    expect(user).toContain("Simplified-Chinese");
  });

  it("states the advice-sentence rule in the system prompt", () => {
    const system = buildEvaluationSystemPrompt(rubric);
    expect(system).toContain("Simplified Chinese");
    expect(
      system,
      "the 建议……，因为…… shape is the difference between an actionable sentence and a noun phrase"
    ).toContain("建议……，因为……");
    expect(system).toContain("English roadmap text is a defect");
  });
});

describe("the mock demonstrates the shape the prompt asks for", () => {
  it("writes every entry as a Chinese advice sentence", () => {
    const roadmap = mockV2Evaluation().trainingRoadmap;
    expect(roadmap, "the mock must carry a roadmap or the mock lane proves nothing").toBeDefined();
    const entries = [...roadmap!.technical, ...roadmap!.behavioral, ...roadmap!.resources];
    expect(entries.length).toBeGreaterThanOrEqual(3);
    for (const entry of entries) {
      expect(entry, `not a Chinese advice sentence: ${entry}`).toMatch(zhAdvice);
      expect(entry, `still English: ${entry}`).not.toMatch(/^[A-Za-z]/);
    }
  });
});

describe("the export leads with the roadmap", () => {
  it("renders it above the rubric and keeps the sentences", () => {
    const markdown = exportInterviewToMarkdown(v2Interview);
    const roadmapAt = markdown.indexOf("## 下一步练什么");
    const readinessAt = markdown.indexOf("## Interview Readiness");
    const rubricAt = markdown.indexOf("## Rubric Dimensions");
    expect(roadmapAt, "the roadmap section is missing from the export").toBeGreaterThan(-1);
    expect(readinessAt).toBeGreaterThan(-1);
    expect(
      roadmapAt,
      "the roadmap must sit above readiness: it is the question the candidate opened the file to answer"
    ).toBeLessThan(readinessAt);
    expect(roadmapAt).toBeLessThan(rubricAt);
    expect(markdown).toContain("建议先讲取舍再写代码，因为");
    expect(markdown).toContain("### 技术重点");
  });

  it("omits the section rather than inventing one for legacy rows", () => {
    const legacy = {
      id: 2,
      title: "旧记录",
      status: "completed",
      createdAt: new Date("2026-11-11T00:00:00Z"),
      updatedAt: new Date("2026-11-11T00:00:00Z"),
    } as unknown as Interview;
    expect(exportInterviewToMarkdown(legacy)).not.toContain("## 下一步练什么");
  });
});

describe("the report page speaks Chinese in the roadmap block", () => {
  const page = readRepo("src/app/dashboard/report/[id]/page.tsx");

  it("uses the Chinese headings", () => {
    for (const heading of ["下一步练什么", "技术重点", "行为与表达", "推荐资源"]) {
      expect(page, `the page no longer renders ${heading}`).toContain(heading);
    }
  });

  it("no longer renders the English headings that made it unreadable", () => {
    for (const heading of ["Technical Focus", "Behavioral Focus", "Recommended Resources", "(Next Steps)"]) {
      expect(page, `the page still renders ${heading}`).not.toContain(heading);
    }
  });

  it("renders sentences as prose, not as bullet fragments", () => {
    // The three roadmap columns must not fall back to <li>: a sentence inside a
    // bullet reads as a fragment of a list rather than advice.
    const roadmapBlock = page.slice(page.indexOf("下一步练什么"), page.indexOf("Replay Timeline"));
    expect(roadmapBlock).toContain("trainingRoadmap.technical.map");
    expect(roadmapBlock).not.toContain("<li key={i}");
  });
});
