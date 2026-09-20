import { generateObject } from 'ai';
import { z } from 'zod';
import { guardRequest, okResponse, errorResponse } from "@/lib/api/guard";
import { logApi, usageOf } from "@/lib/api/logging";
import { classifyUpstreamError } from "@/lib/api/classify-error";
import { resolvePracticeModel, DEFAULT_MAX_RETRIES } from "@/ai/providers/registry";
import { isMockEnabled, mockJson, MOCK_PAYLOADS } from "@/ai/providers/mock";
import { buildPracticeSystem, buildPracticePrompt } from "@/ai/prompts/practice";
import { DRILL_BANK } from "@/ai/drills/bank";
import { evidenceField, confidenceField } from "@/ai/evidence";

export const maxDuration = 60;
export const runtime = 'edge';

const ROUTE = "analyze-practice";

export const PracticeOutputSchema = z.object({
  score: z.number().min(0).max(100).describe("Overall quality score of the answer from 0 to 100."),
  strengths: z.array(z.string()).describe("List of strengths in the candidate's answer."),
  improvements: z.array(z.string()).describe("List of actionable improvements for the candidate's answer."),
  // Phase 4 evidence envelope: verbatim quotes grounding the score.
  // Optional-with-default so older model outputs and stored rows still validate.
  evidence: evidenceField(5, "1-3 verbatim quotes from the candidate's answer that justify the score (exact substrings)."),
  confidence: confidenceField("Evaluator confidence = how much usable evidence the answer contained; never candidate psychology."),
  // Phase 5 drill loop: model-suggested follow-up drills, constrained to the
  // curated bank. Unknown ids are dropped server-side (normalizePracticeDrills),
  // never trusted — same precedent as normalizeEvaluation's off-rubric drop.
  drillIds: z.array(z.string().max(80)).max(3).default([]).describe("Up to 3 drill ids from the provided drill list matching the candidate's weakest areas; empty array if score >= 85."),
});

const BodySchema = z.object({
  question: z.object({
    title: z.string().min(1).max(2000),
    description: z.string().max(10000).optional(),
    category: z.string().max(256).optional(),
  }),
  answer: z.string().min(1).max(20000),
  // Opt-in model override (max 64 chars, unknown values fall through to the
  // validated default). Only "openrouter-structured" diverts — same pattern
  // as interview-chat's `model` field.
  model: z.string().max(64).optional(),
});

const KNOWN_DRILL_IDS = new Set(DRILL_BANK.map((d) => d.id));

/** Drop hallucinated drill ids; cap at 3; never throw (feedback must survive). */
export function normalizePracticeDrills(ids: unknown): string[] {
  if (!Array.isArray(ids)) return [];
  const out: string[] = [];
  for (const id of ids) {
    if (typeof id !== "string") continue;
    if (!KNOWN_DRILL_IDS.has(id)) continue;
    if (!out.includes(id)) out.push(id);
    if (out.length >= 3) break;
  }
  return out;
}

/** P1-01 lane 预算：practice 结构化 lane 默认 45s（< maxDuration 60s；默认 25s 会误杀 deepseek 中位数 ~26s 的正常慢调用）。 */
export const PRACTICE_TIMEOUT_MS = 45_000;

export async function POST(req: Request) {
  const gate = await guardRequest(req, {
    route: ROUTE,
    schema: BodySchema,
    maxBytes: 128 * 1024,
    rateLimit: { limit: 30, windowMs: 60_000 },
    timeoutMs: PRACTICE_TIMEOUT_MS,
  });
  if (!gate.ok) return gate.response;
  const { requestId, data, signal } = gate.ctx;
  const { question, answer, model: modelSpec } = data;
  if (isMockEnabled()) return mockJson(ROUTE, MOCK_PAYLOADS[ROUTE], requestId);
  const startTime = performance.now();

  try {
    // Model selection centralized in providers/registry; default stays the
    // validated Gemini flash lane, unknown specs fall through to it.
    const { model: selectedModel, modelId } = resolvePracticeModel(modelSpec);
    const { object, usage } = await generateObject({
      model: selectedModel, // Fast model
      maxRetries: DEFAULT_MAX_RETRIES,
      system: buildPracticeSystem(),
      schema: PracticeOutputSchema,
      prompt: buildPracticePrompt({ title: question.title, description: question.description, category: question.category, answer }),
      abortSignal: signal,
    });

    logApi(ROUTE, { requestId, status: 200, latencyMs: Math.round(performance.now() - startTime), model: modelId, ...usageOf(usage) });
    return okResponse({ ...object, drillIds: normalizePracticeDrills(object.drillIds) }, requestId);

  } catch (e) {
    logApi(ROUTE, { requestId, status: 500, latencyMs: Math.round(performance.now() - startTime), reason: classifyUpstreamError(e) });
    return errorResponse("UPSTREAM_ERROR", "Failed to analyze practice answer", 500, requestId);
  }
}
