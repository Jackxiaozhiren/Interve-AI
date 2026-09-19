import { generateObject } from "ai";
import { z } from "zod";
import { guardRequest, okResponse, errorResponse } from "@/lib/api/guard";
import { logApi, usageOf } from "@/lib/api/logging";
import { classifyUpstreamError } from "@/lib/api/classify-error";
import { zhipu, MODEL_IDS, DEFAULT_MAX_RETRIES, repairZhipuJson } from "@/ai/providers/registry";
import { isMockEnabled, mockJson, MOCK_PAYLOADS } from "@/ai/providers/mock";
import { buildStarSystem, buildStarPrompt } from "@/ai/prompts/star";
import { evidenceField, confidenceField } from "@/ai/evidence";

export const runtime = 'nodejs';
export const maxDuration = 100;

const ROUTE = "analyze-star";

export const StarOutputSchema = z.object({
  s: z.object({
    progress: z.number().min(0).max(100).describe("Score for Situation"),
    confidence: z.number().min(0).max(100).describe("Confidence in this assessment"),
    timeSpentSeconds: z.number().min(0).describe("Estimated time spent in seconds")
  }),
  t: z.object({
    progress: z.number().min(0).max(100).describe("Score for Task"),
    confidence: z.number().min(0).max(100).describe("Confidence in this assessment"),
    timeSpentSeconds: z.number().min(0).describe("Estimated time spent in seconds")
  }),
  a: z.object({
    progress: z.number().min(0).max(100).describe("Score for Action"),
    confidence: z.number().min(0).max(100).describe("Confidence in this assessment"),
    timeSpentSeconds: z.number().min(0).describe("Estimated time spent in seconds")
  }),
  r: z.object({
    progress: z.number().min(0).max(100).describe("Score for Result"),
    confidence: z.number().min(0).max(100).describe("Confidence in this assessment"),
    timeSpentSeconds: z.number().min(0).describe("Estimated time spent in seconds")
  }),
  // Steering envelope (EVALUATION_V2 §7): verbatim quotes grounding the
  // progress numbers + evaluator confidence. Optional-with-default so older
  // model outputs, mocks, and stored rows still validate. Scores stay 0-100
  // steering heuristics — this lane is NOT an evaluation (see lanes.ts).
  evidence: evidenceField(4, "2-4 verbatim quotes from the candidate's answer grounding the S/T/A/R progress numbers (exact substrings; attribute components where possible)."),
  confidence: confidenceField("Evaluator confidence = how much usable evidence the transcript contained; never candidate psychology."),
});

const BodySchema = z.object({
  transcript: z.string().min(1).max(120000),
  codeContext: z.string().max(60000).optional(),
  systemDesignContext: z.string().max(60000).optional(),
});

export async function POST(req: Request) {
  const gate = await guardRequest(req, {
    route: ROUTE,
    schema: BodySchema,
    maxBytes: 256 * 1024,
    rateLimit: { limit: 30, windowMs: 60_000 },
    // Measured 2026-09-13 (free glm-4-flash ~50 chars/s): small evals need
    // ~45s. nodejs (buffered generateObject has no first byte before completion).
    timeoutMs: 90000,
  });
  if (!gate.ok) return gate.response;
  const { requestId, data, signal } = gate.ctx;
  const { transcript, codeContext, systemDesignContext } = data;
  if (isMockEnabled()) return mockJson(ROUTE, MOCK_PAYLOADS[ROUTE], requestId);
  const startTime = performance.now();

  try {
    const { object, usage } = await generateObject({
      model: zhipu().chat(MODEL_IDS.zhipuFlash), // Use flash model for fast analysis
      maxRetries: DEFAULT_MAX_RETRIES,
      experimental_repairText: repairZhipuJson,
      system: buildStarSystem(),
      prompt: buildStarPrompt({ transcript, codeContext, systemDesignContext }),
      schema: StarOutputSchema,
      abortSignal: signal,
    });

    // H2.4 pilot: per-route token accounting seed (logging only, H3.2 consumes).
    logApi(ROUTE, { requestId, status: 200, latencyMs: Math.round(performance.now() - startTime), model: MODEL_IDS.zhipuFlash, ...usageOf(usage) });
    return okResponse(object, requestId);
  } catch (e) {
    logApi(ROUTE, { requestId, status: 500, latencyMs: Math.round(performance.now() - startTime), reason: classifyUpstreamError(e) });
    return errorResponse("UPSTREAM_ERROR", "Failed to analyze STAR progress", 500, requestId);
  }
}
