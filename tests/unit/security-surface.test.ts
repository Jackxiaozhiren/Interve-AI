// Phase B3 + H4.1/H4.2 (OWASP GenAI 2026 numbering — LLM03 Excessive Agency,
// LLM08 Hidden Context Exposure; the 2025 LLM06/LLM07 labels are retired).
// Verified 2026-09-19: models get ZERO tools (no function calling, no data
// actions — every generate* call is prompt-in/schema-out); no server-only
// keys in client bundles; no connection strings/secrets in prompts;
// validation errors echo field paths only; RAG chunks are resume-text-only.
// This file pins that posture so regressions fail keylessly.
import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const ROOT = new URL("../../", import.meta.url);

function walkTs(dirPath: string, out: string[] = []): string[] {
  for (const e of readdirSync(dirPath)) {
    const full = join(dirPath, e);
    if (statSync(full).isDirectory()) {
      if (e === "node_modules") continue;
      walkTs(full, out);
    } else if (/\.(ts|tsx)$/.test(e)) {
      out.push(full);
    }
  }
  return out;
}

const rootPath = decodeURIComponent(new URL(ROOT).pathname);
const API_ROUTES = walkTs(join(rootPath, "src/app/api")).filter((f) => f.endsWith("route.ts"));
const PROMPT_FILES = walkTs(join(rootPath, "src/ai/prompts"));
const CLIENT_FILES = [...walkTs(join(rootPath, "src/components")), ...walkTs(join(rootPath, "src/app"))].filter((f) =>
  readFileSync(f, "utf8").includes('"use client"')
);

describe("LLM03 Excessive Agency (2026): models touch no tools", () => {
  it("no route passes tools/toolChoice/agentic loops to the model", () => {
    expect(API_ROUTES.length).toBeGreaterThan(0);
    for (const f of API_ROUTES) {
      const text = readFileSync(f, "utf8");
      expect(text, `${f}: tools`).not.toMatch(/[^a-zA-Z]tools\s*:/);
      expect(text, `${f}: toolChoice`).not.toContain("toolChoice");
      expect(text, `${f}: maxSteps`).not.toContain("maxSteps");
      expect(text, `${f}: stopWhen`).not.toContain("stopWhen");
      // H4.1 extension: step-preparation hooks + explicit tool activation
      // (verified zero hits 2026-09-19 — any future hit fails loudly).
      expect(text, `${f}: prepareStep`).not.toContain("prepareStep");
      expect(text, `${f}: activeTools`).not.toContain("activeTools");
    }
  });
});

describe("B4 access-control: orama_index is user-partitioned", () => {
  it("tracks the ./db alias: db === dbClient, so db.oramaIndex IS the Supabase table", () => {
    // Regression guard for the Phase-B false negative (this test once missed
    // the alias and claimed the table unwired while orama-client used it).
    const dbSrc = readFileSync(join(rootPath, "src/lib/db.ts"), "utf8");
    expect(dbSrc, "./db binds dbClient").toMatch(/dbClient/);
    const oc = readFileSync(join(rootPath, "src/lib/orama-client.ts"), "utf8");
    expect(oc, "orama-client uses the shared db").toContain("from './db'");
  });

  it("orama-client partitions by user (no global-id writes)", () => {
    const oc = readFileSync(join(rootPath, "src/lib/orama-client.ts"), "utf8");
    expect(oc, "namespaced hub ids").toContain("hubIdForUser");
    expect(oc, "user_id stamp").toContain("user_id");
    // No hardcoded global-id reads/writes outside the legacy fallback.
    const legacyUses = oc.split("\n").filter((l) => l.includes("LEGACY_HUB_ID"));
    expect(legacyUses.length).toBeGreaterThan(0);
    expect(oc).not.toMatch(/get\('resume-index'\)/);
    expect(oc).not.toMatch(/id: 'resume-index',/);
  });
});

describe("LLM08 Hidden Context Exposure (2026): prompt + RAG + logs + errors", () => {
  const SERVER_KEYS = ["ZHIPU_API_KEY", "GOOGLE_GENERATIVE_AI_API_KEY", "OPENAI_API_KEY", "SESSION_SECRET", "service_role"];
  const SECRET_PATTERNS = ["supabase.co", "open.bigmodel.cn", "service_role", "sk-ant-", "sk-proj-", "mongodb://", "postgres://"];

  it("client components read no server-only keys", () => {
    const clients = CLIENT_FILES.filter((f) => readFileSync(f, "utf8").includes('"use client"'));
    expect(clients.length).toBeGreaterThan(0);
    for (const f of clients) {
      const text = readFileSync(f, "utf8");
      for (const k of SERVER_KEYS) {
        expect(text, `${f}:${k}`).not.toContain(k);
      }
    }
  });

  it("prompts embed no connection strings, secrets, or internal rules", () => {
    expect(PROMPT_FILES.length).toBeGreaterThan(0);
    for (const f of PROMPT_FILES) {
      const text = readFileSync(f, "utf8");
      for (const p of SECRET_PATTERNS) {
        expect(text, `${f}:${p}`).not.toContain(p);
      }
      expect(text, `${f}:NEXT_PUBLIC`).not.toContain("NEXT_PUBLIC_");
    }
  });

  // H4.2: audit surface widened beyond prompts — RAG chunks are resume-text
  // only (mechanical 500/50 split; no system/model/secret content), and no
  // route echoes raw provider errors or request bodies into logs/responses
  // (classifyUpstreamError class tokens + path-only validation messages).
  it("RAG chunks carry resume text only (no prompt/secret content)", () => {
    const oc = readFileSync(join(rootPath, "src/lib/orama-client.ts"), "utf8");
    expect(oc, "chunk source is the user resume").toContain("chunkText(resumeText)");
    expect(oc, "index schema is text-only").toMatch(/schema:\s*\{\s*text:\s*'string'/);
  });

  it("no route echoes raw errors or request bodies (class tokens + paths only)", () => {
    expect(API_ROUTES.length).toBeGreaterThan(0);
    for (const f of API_ROUTES) {
      const text = readFileSync(f, "utf8");
      expect(text, `${f}: error.message`).not.toMatch(/error\.message/);
      expect(text, `${f}: String(e)`).not.toMatch(/String\(e\b/);
      expect(text, `${f}: dollar-e`).not.toMatch(/\$\{e\}/);
      expect(text, `${f}: dollar-error`).not.toMatch(/\$\{error\}/);
    }
    const v = readFileSync(join(rootPath, "src/lib/api/validate.ts"), "utf8");
    expect(v, "generic validation envelope").toContain("Invalid request body (");
  });
});

describe("LLM09 Misinformation (2026): verdicts ride verbatim evidence + disclaimer", () => {
  // Keyless half of H4.3 (nightly quote-trace sampling is the keyed half):
  // every evaluative output schema carries verbatim evidence + evaluator
  // confidence, dimensions require >=1 quote, and the practice-only
  // disclaimer has exactly one source rendered on all verdict surfaces.
  const VERDICT_ROUTES = [
    "analyze-match",
    "analyze-alignment",
    "analyze-practice",
    "analyze-star",
    "analyze-chunk",
    "analyze-behavior",
  ];

  it("verdict routes keep evidence + confidence envelope fields", () => {
    for (const r of VERDICT_ROUTES) {
      const text = readFileSync(join(rootPath, "src/app/api", r, "route.ts"), "utf8");
      expect(text, `${r}: evidenceField`).toContain("evidenceField");
      expect(text, `${r}: confidenceField`).toContain("confidenceField");
    }
  });

  it("V2 dimensions require >=1 verbatim quote; disclaimer is single-sourced", () => {
    const c = readFileSync(join(rootPath, "src/ai/evaluation-contract.ts"), "utf8");
    expect(c, "dimension evidence floor").toContain(
      "evidence: z.array(z.string().min(1).max(500)).min(1).max(6),"
    );
    expect(c, "single disclaimer source").toContain("export const READINESS_DISCLAIMER");
    for (const f of [
      "src/components/evaluation/EvaluationView.tsx",
      "src/components/interview/PrintLayout.tsx",
      "src/components/dashboard/PrintableDossier.tsx",
      "src/lib/utils/export.ts",
      "src/ai/prompts/evaluation.ts",
    ]) {
      const text = readFileSync(join(rootPath, f), "utf8");
      expect(text, `${f}: disclaimer`).toContain("READINESS_DISCLAIMER");
    }
  });
});

describe("LLM10 Unbounded Consumption (2026): every AI call is metered", () => {
  // Keyless half of H4.4 (token fuse levels wait for H3.2 measured numbers):
  // all 15 AI routes flow token counts into logApi (sync usageOf, deferred
  // logStreamUsage, or reportUsage via the fallback helper) so the fuse has
  // per-route input/output data to bite on. B6/C1 enforcement itself is
  // pinned by user-budget + quota-ledger tests.
  it("all AI routes report token usage (no unmetered generation call)", () => {
    const routes = API_ROUTES.map((f) => ({
      file: f,
      text: readFileSync(f, "utf8"),
    })).filter(({ text }) => /await (generateObject|generateText|streamText)\(/.test(text));
    expect(routes.length).toBe(16);
    for (const { file: f, text } of routes) {
      const metered =
        text.includes("usageOf(") || text.includes("logStreamUsage(") || text.includes("reportUsage");
      expect(metered, `${f}: token metering`).toBe(true);
    }
  });
});
