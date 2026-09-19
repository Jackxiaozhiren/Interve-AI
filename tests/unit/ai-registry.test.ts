// Phase 5: prompt registry + provider decoupling guards.
import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { PROMPT_REGISTRY } from "../../src/ai/prompts";
import { MODEL_IDS } from "../../src/ai/providers/registry";
import { buildInterviewSystemPrompt } from "../../src/ai/prompts/interview";
import { buildStarPrompt, buildStarSystem } from "../../src/ai/prompts/star";
import { buildMatchPrompt } from "../../src/ai/prompts/match";
import { buildJdSystem, buildJdPrompt } from "../../src/ai/prompts/jd";
import { buildCopilotSystem } from "../../src/ai/prompts/copilot";
import { buildHintSystem, buildHintPrompt } from "../../src/ai/prompts/hint";
import { buildVisionText } from "../../src/ai/prompts/vision";
import { buildTrendsPrompt } from "../../src/ai/prompts/trends";
import { buildOcrInstruction } from "../../src/ai/prompts/resume";
import { buildContextSystem, buildContextPrompt } from "../../src/ai/prompts/context";
import { buildAlignmentPrompt } from "../../src/ai/prompts/alignment";
import { buildBehaviorSystem, buildBehaviorPrompt } from "../../src/ai/prompts/behavior";
import { buildChunkSystem, buildChunkPrompt } from "../../src/ai/prompts/chunk";
import { buildCodePrompt } from "../../src/ai/prompts/code";
import { buildPracticeSystem, buildPracticePrompt } from "../../src/ai/prompts/practice";

const ROOT = new URL("../../", import.meta.url);
const read = (p: string) => readFileSync(new URL(p, ROOT), "utf8");
const exists = (p: string) => existsSync(new URL(p, ROOT));

describe("prompt registry", () => {
  it("has 17 unique versioned entries", () => {
    expect(PROMPT_REGISTRY).toHaveLength(17);
    const ids = PROMPT_REGISTRY.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const p of PROMPT_REGISTRY) {
      expect(p.version).toMatch(/^\d+\.\d+(\.\d+)?$/);
    }
  });
});

describe("provider decoupling (static)", () => {
  const routes = [
    "analyze-alignment", "analyze-behavior", "analyze-chunk", "analyze-code",
    "analyze-interview", "analyze-match", "analyze-practice", "analyze-star",
    "analyze-trends", "analyze-vision", "copilot", "generate-hint",
    "init-context", "interview-chat", "parse-jd", "parse-resume",
  ];

  it("no route constructs provider clients directly", () => {
    for (const r of routes) {
      const src = read(`src/app/api/${r}/route.ts`);
      expect(src, r).not.toContain("createOpenAI(");
      expect(src, r).not.toContain("from '@ai-sdk/google'");
      expect(src, r).not.toContain('from "@ai-sdk/google"');
    }
  });

  it("no route hardcodes model ids (single source in registry)", () => {
    const ids = Object.values(MODEL_IDS) as string[];
    for (const r of routes) {
      const src = read(`src/app/api/${r}/route.ts`);
      for (const id of ids) {
        expect(src, `${r}:${id}`).not.toContain(`"${id}"`);
        expect(src, `${r}:${id}`).not.toContain(`'${id}'`);
      }
    }
  });

  it("every AI route honors mock mode after its gate", () => {
    for (const r of routes) {
      const src = read(`src/app/api/${r}/route.ts`);
      expect(src, r).toContain("isMockEnabled()");
    }
  });

  it("registry is the only ai-sdk client construction site", () => {
    expect(read("src/ai/providers/registry.ts")).toContain("createOpenAI(");
  });

  it("cost-aware routing uses .chat() (Responses /responses 404s on Zhipu)", () => {
    const src = read("src/ai/providers/registry.ts");
    // The callable default is the Responses API; Zhipu only serves
    // chat-completions. Live-verified 2026-09-13 (free key).
    expect(src).not.toMatch(/zhipu\(\)\(/);
    expect(src).toContain("zhipu().chat(modelId)");
  });

  it("every Zhipu generateObject site wires fence repair", () => {
    for (const r of ["analyze-interview", "analyze-match", "analyze-star", "analyze-behavior", "analyze-chunk", "init-context"]) {
      const src = read(`src/app/api/${r}/route.ts`);
      expect(src, r).toContain("repairZhipuJson");
    }
  });
});

describe("prompt builders preserve behavior", () => {
  it("interview: persona mapping + STAR/behavioral/company branches intact", () => {
    const base = buildInterviewSystemPrompt({ role: "Backend", level: "Senior", persona: "professional" });
    expect(base).toContain("Panel Interview");
    expect(base).toContain("Backend");
    expect(base).toContain("[Tech]");
    const full = buildInterviewSystemPrompt({
      role: "FE", level: "Junior", persona: "stress", stressTest: true,
      framework: "star", company: "amazon",
      context: "CTX", setupContext: "SC", resumeText: "RES",
      codeContext: "CODE", systemDesignContext: "SD",
      starProgress: {
        s: { progress: 10, confidence: 10, timeSpentSeconds: 1 },
        t: { progress: 80, confidence: 80, timeSpentSeconds: 1 },
        a: { progress: 80, confidence: 80, timeSpentSeconds: 1 },
        r: { progress: 80, confidence: 80, timeSpentSeconds: 1 },
      },
      behavioralTraits: { leadership: 10, problemSolving: 90, communication: 90 },
    });
    // Byte-preserved corruption markers (repair tracked, not silently fixed).
    // U+FFFD sequences from an old encoding round-trip; changing them alters
    // model input and requires eval measurement (AI_ARCHITECTURE_REPORT).
    expect(full).toContain("技术主");
    expect(full).toContain("�?");
    expect(full).toContain("FAANG顶级压力测试");
    expect(full).toContain("极度缺乏情境(S)");
    // Phase 6: stealth probing removed in favor of transparent coverage.
    expect(full).not.toContain("隐蔽地");
    expect(full).toContain("Amazon LPs");
    expect(full).toContain("CTX");
    expect(full).toContain("候选人的简历内容");
  });

  it("interview: empty background falls back to generic line", () => {
    const s = buildInterviewSystemPrompt({ role: "X", level: "Y", persona: "professional" });
    expect(s).toContain("暂无特别背景");
  });

  it("star/behavior/chunk interpolate inputs", () => {
    expect(buildStarPrompt({ transcript: "T0" })).toContain("T0");
    // Phase 3 truthfulness: no minimum-score floor; evidence-only credit.
    expect(buildStarSystem()).not.toContain("at least 40");
    expect(buildStarSystem()).toContain("Never inflate");
    expect(buildBehaviorPrompt("B0")).toContain("B0");
    expect(buildBehaviorSystem()).toContain("If completely missing, score 0");
    expect(buildChunkPrompt("C0")).toContain("C0");
    expect(buildChunkSystem({ role: "R", level: "L" })).toContain("expert L R");
  });

  it("match/jd/copilot/hint/vision/trends/resume/context/alignment/code/practice interpolate", () => {
    expect(buildMatchPrompt({ resumeText: "R", jobDescription: "J" })).toContain("J");
    expect(buildMatchPrompt({ jobDescription: "J" })).toContain("No resume provided");
    expect(buildJdSystem({ jobDescription: "J", questionCount: 7 })).toContain("exactly 7");
    expect(buildCopilotSystem({ question: "Q?", resumeSnippets: ["S1"] })).toContain("S1");
    expect(buildHintSystem({ currentCode: "C" })).toContain("C");
    expect(buildHintPrompt("H")).toContain("H");
    expect(buildVisionText({ problemContext: "P" })).toContain("P");
    expect(buildTrendsPrompt(3, "{}")).toContain("last 3 interview");
    expect(buildOcrInstruction()).toContain("Do not summarize");
    expect(buildContextPrompt({ jobDescription: "J", resumeContext: "R" })).toContain("R");
    expect(buildContextSystem()).toContain("zh-CN");
    expect(buildAlignmentPrompt({ resumeText: "R", jobDescription: "J" })).toContain("RESUME");
    expect(buildCodePrompt({ code: "C", language: "ts", problemStatement: "P" })).toContain("P");
    expect(buildPracticeSystem()).toContain("0-100");
    expect(buildPracticePrompt({ title: "T", answer: "A" })).toContain("T");
  });
});

describe("untrusted-content fences (Phase 12 injection hardening)", () => {
  it("wraps candidate-controlled inputs as data, never instructions", async () => {
    const { buildEvaluationUserPrompt } = await import("../../src/ai/prompts/evaluation");
    expect(buildEvaluationUserPrompt([{ role: "user", content: "x" }])).toContain("UNTRUSTED TRANSCRIPT");
    expect(
      buildInterviewSystemPrompt({ role: "R", level: "L", persona: "professional", context: "C" })
    ).toContain("UNTRUSTED CANDIDATE CONTENT");
    // Empty background emits no fences (no token waste, no behavior change).
    expect(
      buildInterviewSystemPrompt({ role: "R", level: "L", persona: "professional" })
    ).not.toContain("UNTRUSTED");
    expect(buildCopilotSystem({ question: "Q", resumeSnippets: ["S"] })).toContain("UNTRUSTED RESUME SNIPPETS");
    expect(buildMatchPrompt({ jobDescription: "J" })).toContain("UNTRUSTED JOB DESCRIPTION");
    expect(buildAlignmentPrompt({ resumeText: "R", jobDescription: "J" })).toContain("UNTRUSTED RESUME");
  });

  it("Phase 3: every user-content builder fences inputs as data (14/14)", () => {
    // Builders hardened in Phase 3 (were bare interpolation before).
    expect(buildBehaviorPrompt("B0")).toContain("UNTRUSTED TRANSCRIPT");
    expect(buildStarPrompt({ transcript: "T0" })).toContain("UNTRUSTED TRANSCRIPT");
    expect(buildStarPrompt({ transcript: "T0", codeContext: "C" })).toContain("UNTRUSTED CODE CONTEXT");
    expect(buildPracticePrompt({ title: "T", answer: "A" })).toContain("UNTRUSTED ANSWER");
    expect(buildCodePrompt({ code: "C", language: "ts", problemStatement: "P" })).toContain("UNTRUSTED CODE");
    expect(buildJdPrompt("J")).toContain("UNTRUSTED JOB DESCRIPTION");
    expect(buildContextPrompt({ jobDescription: "J", resumeContext: "R" })).toContain("UNTRUSTED RESUME CONTEXT");
    expect(buildHintSystem({ currentCode: "C" })).toContain("UNTRUSTED CODE");
    expect(buildHintPrompt("H")).toContain("UNTRUSTED CHAT HISTORY");
    expect(buildVisionText({ problemContext: "P" })).toContain("UNTRUSTED PROBLEM CONTEXT");
    expect(buildTrendsPrompt(3, "{}")).toContain("UNTRUSTED SESSION DATA");
    expect(buildChunkPrompt("C0")).toContain("UNTRUSTED CHUNK");
    expect(buildChunkSystem({ role: "R", level: "L" })).toContain("UNTRUSTED INTERVIEW CONTEXT");
    // No builder may instruct the model to treat fenced content as instructions.
    expect(buildChunkSystem({ role: "R", level: "L" })).toContain("do NOT infer emotions");
  });

  it("Phase B1: all 10 generateObject lanes carry STRICT_JSON_SUFFIX (format-only)", async () => {
    const { buildEvaluationUserPrompt } = await import("../../src/ai/prompts/evaluation");
    // Convention: suffix lives in the system prompt where one exists,
    // else in the single user prompt. Assert per-lane (system + user).
    const lane = (sys: string, user: string) => `${sys}\n${user}`;
    expect(lane(buildBehaviorSystem(), buildBehaviorPrompt("B"))).toContain("STRICT OUTPUT CONTRACT");
    expect(lane(buildStarSystem(), buildStarPrompt({ transcript: "T" }))).toContain("STRICT OUTPUT CONTRACT");
    expect(lane(buildPracticeSystem(), buildPracticePrompt({ title: "T", answer: "A" }))).toContain("STRICT OUTPUT CONTRACT");
    expect(lane(buildContextSystem(), buildContextPrompt({ jobDescription: "J", resumeContext: "R" }))).toContain("STRICT OUTPUT CONTRACT");
    expect(lane(buildChunkSystem({ role: "R", level: "L" }), buildChunkPrompt("C"))).toContain("STRICT OUTPUT CONTRACT");
    expect(buildMatchPrompt({ resumeText: "R", jobDescription: "J" })).toContain("STRICT OUTPUT CONTRACT");
    // Newly suffixed in B1 (4): evaluation/code/jd/alignment.
    expect(buildEvaluationUserPrompt([{ role: "user", content: "x" }])).toContain("STRICT OUTPUT CONTRACT");
    expect(buildCodePrompt({ code: "C", language: "ts", problemStatement: "P" })).toContain("STRICT OUTPUT CONTRACT");
    expect(buildJdPrompt("J")).toContain("STRICT OUTPUT CONTRACT");
    expect(buildAlignmentPrompt({ resumeText: "R", jobDescription: "J" })).toContain("STRICT OUTPUT CONTRACT");
    // Suffix constrains FORMAT only (fences/keys) — scoring prose untouched.
    expect(buildEvaluationUserPrompt([{ role: "user", content: "x" }])).toContain("UNTRUSTED TRANSCRIPT");
  });
});

describe("openrouter opt-in (free third lane, explicit only)", () => {
  it("resolves openrouter specs without touching defaults", async () => {
    const { resolveChatModel, resolvePracticeModel, resetProviderClients } = await import("../../src/ai/providers/registry");
    resetProviderClients();
    expect(resolveChatModel("openrouter").modelId).toBe(MODEL_IDS.openrouterChat);
    expect(resolveChatModel("openrouter-structured").modelId).toBe(MODEL_IDS.openrouterStructured);
    // Unknown specs still fall through to the Zhipu default.
    expect(resolveChatModel("nope").modelId).toBe(MODEL_IDS.zhipuThinking);
    expect(resolveChatModel(undefined).modelId).toBe(MODEL_IDS.zhipuThinking);
    // Practice lane: default stays validated Gemini flash; only the
    // structured opt-in diverts.
    expect(resolvePracticeModel("openrouter-structured").modelId).toBe(MODEL_IDS.openrouterStructured);
    expect(resolvePracticeModel(undefined).modelId).toBe(MODEL_IDS.geminiFlash);
    expect(resolvePracticeModel("nope").modelId).toBe(MODEL_IDS.geminiFlash);
    expect(resolvePracticeModel("openrouter").modelId).toBe(MODEL_IDS.geminiFlash);
    resetProviderClients();
  });

  it("registry constructs openrouter via OpenAI-compatible baseURL", () => {
    const src = read("src/ai/providers/registry.ts");
    expect(src).toContain("https://openrouter.ai/api/v1");
    expect(src).toContain("OPENROUTER_API_KEY");
    // Must use .chat() — same Responses-API 404 trap as Zhipu.
    expect(src).toContain("openrouter().chat(");
    expect(src).not.toMatch(/openrouter\(\)\(/);
  });
});

describe("stripJsonFences (Zhipu fence repair, live-shaped fixtures)", () => {
  it("strips python fences + assignment prefix, leaves clean JSON alone", async () => {
    const { stripJsonFences, repairZhipuJson } = await import("../../src/ai/providers/registry");
    expect(stripJsonFences('```python\nresult = {"a":1}\n```')).toBe('{"a":1}');
    expect(stripJsonFences('```json\n{"a":1}\n```')).toBe('{"a":1}');
    expect(stripJsonFences('response = {"a":1}')).toBe('{"a":1}');
    expect(stripJsonFences('{"a":1}')).toBe('{"a":1}');
    // Live shape: fenced JSON + trailing explanation prose (star 2026-09-13).
    expect(stripJsonFences('```json\n{"a":1}\n```\n\n**Explanation:**\n\n- foo')).toBe('{"a":1}');
    expect(await repairZhipuJson({ text: '{"a":1}' })).toBeNull();
    expect(await repairZhipuJson({ text: '```python\nresult = {"a":1}\n```' })).toBe('{"a":1}');
  });
});

describe("strict-JSON key pinning (free glm-4-flash follows prose, not schema)", () => {
  it("star/chunk/match/context name exact keys + forbid fences", async () => {
    const { buildStarSystem } = await import("../../src/ai/prompts/star");
    const { buildChunkSystem } = await import("../../src/ai/prompts/chunk");
    const { buildMatchPrompt } = await import("../../src/ai/prompts/match");
    const { buildContextSystem } = await import("../../src/ai/prompts/context");
    const { STRICT_JSON_SUFFIX } = await import("../../src/ai/prompts/strict-json");
    expect(STRICT_JSON_SUFFIX).toContain("ONLY one raw JSON object");
    const star = buildStarSystem();
    expect(star).toContain("EXACTLY these top-level keys: s, t, a, r");
    expect(star).toContain("timeSpentSeconds");
    expect(star).not.toContain("at least 40"); // Phase 3: floor removed
    const { buildStarPrompt: buildStarUser } = await import("../../src/ai/prompts/star");
    expect(buildStarUser({ transcript: "T0" })).toContain("UNTRUSTED TRANSCRIPT"); // fences live in user prompt
    const chunk = buildChunkSystem({ role: "R", level: "L" });
    expect(chunk).toContain("sentimentScore");
    expect(chunk).toContain("technicalAccuracy");
    const match = buildMatchPrompt({ jobDescription: "J" });
    expect(match).toContain("overallScore");
    expect(match).toContain("UNTRUSTED JOB DESCRIPTION"); // hardening preserved
    const ctx = buildContextSystem();
    expect(ctx).toContain("topPredictions");
    expect(ctx).toContain("keyPointsToHit");
    expect(ctx).toContain("zh-CN"); // pre-existing behavior preserved
  });
});

describe("registry files exist", () => {
  it("all prompt modules + providers present", () => {
    for (const f of ["interview", "star", "behavior", "chunk", "code", "practice", "alignment", "match", "jd", "context", "copilot", "hint", "vision", "trends", "resume"]) {
      expect(exists(`src/ai/prompts/${f}.ts`), f).toBe(true);
    }
    for (const f of ["registry", "fallback", "mock"]) {
      expect(exists(`src/ai/providers/${f}.ts`), f).toBe(true);
    }
  });
});
