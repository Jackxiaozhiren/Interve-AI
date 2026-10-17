// Phase 5: prompt registry + provider decoupling guards.
import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import ts from "typescript";
import { walkRepo } from "./repo-tree";
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

/**
 * The `id` of every option handed to a JSX attribute named `models`, in source order.
 *
 * Keyed on the prop, not on the component that used it: `<ModelChooser models={[…]} />`
 * carries the same promise, and a rule that only sees one tag name is a rule the next
 * picker walks straight past.
 *
 * AST rather than text: the options are an array of object literals spread over
 * several lines inside JSX, and a line-scanning version of this rule is exactly the
 * shape that has read a comment as a call site here before.
 */
function selectorOptionIds(text: string, file: string): { file: string; id: string }[] {
  const sf = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const out: { file: string; id: string }[] = [];
  const visit = (node: ts.Node) => {
    if (ts.isJsxAttribute(node) && ts.isIdentifier(node.name) && node.name.text === "models") {
      const init = node.initializer;
      if (init && ts.isJsxExpression(init) && init.expression && ts.isArrayLiteralExpression(init.expression)) {
        for (const element of init.expression.elements) {
          if (!ts.isObjectLiteralExpression(element)) continue;
          for (const prop of element.properties) {
            if (ts.isPropertyAssignment(prop) && prop.name.getText(sf) === "id" && ts.isStringLiteral(prop.initializer)) {
              out.push({ file, id: prop.initializer.text });
            }
          }
        }
      }
    }
    node.forEachChild(visit);
  };
  visit(sf);
  return out;
}

/** Every string literal a file assigns to a `model` property, e.g. a request body. */
function modelStringLiterals(text: string, file: string): { file: string; id: string }[] {
  const sf = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const out: { file: string; id: string }[] = [];
  const visit = (node: ts.Node) => {
    if (ts.isPropertyAssignment(node) && node.name.getText(sf) === "model" && ts.isStringLiteral(node.initializer)) {
      out.push({ file, id: node.initializer.text });
    }
    node.forEachChild(visit);
  };
  visit(sf);
  return out;
}

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

  it("a model choice the client offers or sends is one the resolver can honour", () => {
    // /chat's header carried a three-way picker — GLM-4 Flash, GLM-4 Plus "Pro",
    // GLM-4 Long — while `resolveChatModel` branches on provider *specs*
    // ("openai" / "gemini" / "openrouter" / "openrouter-structured") and returns
    // MODEL_IDS.zhipuThinking for anything else. Every one of the three ids is
    // "anything else", so the three buttons selected the same model, the label
    // "GLM-4 Flash" named a model that never answered, and "Pro" advertised a tier
    // the product does not have. The privacy page already says this out loud —
    // 未识别的取值一律回落到默认提供方 — which is what made the picker, not the
    // policy, the lie.
    const specs = new Set(
      [...read("src/ai/providers/registry.ts").matchAll(/if \(spec === "([^"]+)"\)/g)].map((m) => m[1]),
    );
    expect(specs.size, "the resolver's spec list went unread — this arm would pass on blindness").toBeGreaterThanOrEqual(3);

    const offered = walkRepo("src", (rel) => /\.tsx$/.test(rel)).flatMap((f) => selectorOptionIds(read(f), f));
    const unresolved = offered.filter((o) => !specs.has(o.id));
    expect(
      unresolved.map((o) => `${o.file}: "${o.id}" is not a value resolveChatModel discriminates`),
      "a model control offers an id the server cannot route",
    ).toEqual([]);

    // The other half of the same defect: a body that names a model the route will
    // ignore. Measured 2026-10-13 after /chat's picker came out: no client file
    // outside src/app/api assigns a string literal to `model` at all, so this half
    // guards an empty corpus today — which is why the arm below shows the extractor
    // can see one.
    const sent = walkRepo("src", (rel) => /\.(ts|tsx)$/.test(rel) && !rel.startsWith("src/app/api/"))
      .flatMap((f) => modelStringLiterals(read(f), f))
      .filter((o) => !specs.has(o.id));
    expect(
      sent.map((o) => `${o.file}: model: "${o.id}"`),
      "a client sends a model value the resolver falls through on",
    ).toEqual([]);
  });

  it("sees a selector's options and a body's model field at all, and does not invent them", () => {
    // Both arms above pass on an empty corpus, so the extraction is shown working on
    // snippets shaped like what it found in the wild. The picker name is deliberately
    // not the component /chat used, because the rule keys on the `models` prop: a
    // renamed control must not inherit a blind spot.
    const sample = `
      <ModelChooser
        models={[{ id: "openai", name: "GPT" }, { id: "glm-4-plus", name: "GLM-4 Plus", badge: "Pro" }]}
        value={selectedModel}
        onChange={setSelectedModel}
      />`;
    expect(selectorOptionIds(sample, "sample.tsx").map((o) => o.id)).toEqual(["openai", "glm-4-plus"]);
    expect(selectorOptionIds("<ModelBadge model=\"glm-4-flash\" />", "sample.tsx")).toEqual([]);
    expect(modelStringLiterals('const t = new Transport({ body: { model: "glm-4-flash", level: "Mid" } });', "sample.tsx"))
      .toEqual([{ file: "sample.tsx", id: "glm-4-flash" }]);
    expect(modelStringLiterals("const m = { model: resolveChatModel(spec).modelId };", "sample.tsx")).toEqual([]);
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
    // Used to read `toContain("expert L R")`. 1.3.0 fenced the position slot because
    // `role`/`level` arrive from `?role=` and the request body with no enum behind
    // them, so the adjacency moved inside the label. This asserts the same thing
    // harder: both values still reach the line, in order, as labelled data.
    expect(buildChunkSystem({ role: "R", level: "L" })).toMatch(
      /expert ### UNTRUSTED POSITION LABEL START .* L R ### UNTRUSTED POSITION LABEL END ### technical interviewer/
    );
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
    // Empty background emits no BACKGROUND fence (no token waste, no behavior
    // change). The literal used to be `not.toContain("UNTRUSTED")` — a proxy for
    // "nothing got fenced", which 1.3.0 invalidates: the position label is fenced
    // unconditionally now, because it always carries a value. So the assertion
    // names the block it was ever about and pins the count, which is stricter than
    // the proxy: one fence pair, and it is the label, not the background.
    const bare = buildInterviewSystemPrompt({ role: "R", level: "L", persona: "professional" });
    expect(bare).not.toContain("UNTRUSTED CANDIDATE CONTENT");
    expect(bare.match(/UNTRUSTED [A-Z ]*START/g) ?? []).toHaveLength(1);
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
