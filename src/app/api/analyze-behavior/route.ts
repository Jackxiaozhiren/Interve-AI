import { generateObject } from "ai";
import { z } from "zod";
import { guardRequest, okResponse, errorResponse } from "@/lib/api/guard";
import { logApi, usageOf } from "@/lib/api/logging";
import { classifyUpstreamError } from "@/lib/api/classify-error";
import { zhipu, MODEL_IDS, DEFAULT_MAX_RETRIES, repairZhipuJson } from "@/ai/providers/registry";
import { isMockEnabled, mockJson, MOCK_PAYLOADS } from "@/ai/providers/mock";
import { buildBehaviorSystem, buildBehaviorPrompt } from "@/ai/prompts/behavior";
import { evidenceField, confidenceField } from "@/ai/evidence";

export const runtime = 'nodejs';
export const maxDuration = 100;

const ROUTE = "analyze-behavior";

export const BehaviorOutputSchema = z.object({
  leadership: z.number().min(0).max(100).describe("Score for Leadership"),
  problemSolving: z.number().min(0).max(100).describe("Score for Problem Solving"),
  communication: z.number().min(0).max(100).describe("Score for Communication"),
  // Steering envelope (EVALUATION_V2 §7): same precedent as the star lane —
  // optional-with-default, scores stay 0-100 steering heuristics.
  evidence: evidenceField(4, "1-3 verbatim quotes from the candidate's transcript grounding the trait numbers (exact substrings)."),
  confidence: confidenceField("Evaluator confidence = how much usable evidence the transcript contained; never candidate psychology."),
});

const BodySchema = z.object({
  transcript: z.string().min(1).max(120000),
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
  const { transcript } = data;
  if (isMockEnabled()) return mockJson(ROUTE, MOCK_PAYLOADS[ROUTE], requestId);
  const startTime = performance.now();

  try {
    const { object, usage } = await generateObject({
      model: zhipu().chat(MODEL_IDS.zhipuFlash), // Use flash model for fast analysis
      maxRetries: DEFAULT_MAX_RETRIES,
      experimental_repairText: repairZhipuJson,
      system: buildBehaviorSystem(),
      prompt: buildBehaviorPrompt(transcript),
      schema: BehaviorOutputSchema,
      abortSignal: signal,
    });

    logApi(ROUTE, { requestId, status: 200, latencyMs: Math.round(performance.now() - startTime), model: MODEL_IDS.zhipuFlash, ...usageOf(usage) });
    return okResponse(object, requestId);
  } catch (e) {
    logApi(ROUTE, { requestId, status: 500, latencyMs: Math.round(performance.now() - startTime), reason: classifyUpstreamError(e) });
    return errorResponse("UPSTREAM_ERROR", "Failed to analyze behavioral traits", 500, requestId);
  }
}
