import { generateObject } from 'ai';
import { z } from 'zod';
import { guardRequest, okResponse, errorResponse } from "@/lib/api/guard";
import { logApi } from "@/lib/api/logging";
import { zhipu, MODEL_IDS, DEFAULT_MAX_RETRIES, repairZhipuJson } from "@/ai/providers/registry";
import { isMockEnabled, mockJson, MOCK_PAYLOADS } from "@/ai/providers/mock";
import { buildChunkSystem, buildChunkPrompt } from "@/ai/prompts/chunk";
import { evidenceField, confidenceField } from "@/ai/evidence";

// Config specific to this route
export const maxDuration = 120; // 120 seconds (free-tier flash streams ~50 chars/s)
export const runtime = 'nodejs';

// Phase 3 note: `sentimentScore` is a rough real-time delivery heuristic, NOT
// emotion inference — the prompt (chunk.ts 1.1.0) now forbids inferring
// emotions/personality/stress/honesty and all inputs are UNTRUSTED-fenced.
// It has zero in-product consumers (the interview page stopped calling this
// endpoint) and MUST NOT be presented as a psychological measurement.
// The Phase 4 rubric engine will redefine this endpoint around observable
// delivery signals or remove it.
const ROUTE = "analyze-chunk";

export const ChunkOutputSchema = z.object({
  sentimentScore: z.number().describe("0 to 100. 100 is highly confident, positive, and fluent. 0 is extremely nervous, hesitant, or negative."),
  technicalAccuracy: z.number().describe("0 to 100. 100 is perfectly accurate and highly relevant to the context. 0 is completely wrong or irrelevant."),
  // Steering envelope (EVALUATION_V2 §7): optional-with-default. This endpoint
  // has zero in-product consumers (callerless pin in prohibitions.test.ts);
  // the envelope exists so any future revival is grounded from birth.
  evidence: evidenceField(2, "1-2 verbatim quotes from the chunk grounding the delivery/accuracy numbers (exact substrings)."),
  confidence: confidenceField("Evaluator confidence = how much usable evidence the chunk contained; never candidate psychology."),
});

const BodySchema = z.object({
  text: z.string().min(1).max(20000),
  context: z.string().max(12000).optional(),
  role: z.string().max(256).optional(),
  level: z.string().max(256).optional(),
});

export async function POST(req: Request) {
  const gate = await guardRequest(req, {
    route: ROUTE,
    schema: BodySchema,
    maxBytes: 256 * 1024,
    rateLimit: { limit: 30, windowMs: 60_000 },
    timeoutMs: 110000,
  });
  if (!gate.ok) return gate.response;
  const { requestId, data, signal } = gate.ctx;
  const { text, context, role, level } = data;
  if (isMockEnabled()) return mockJson(ROUTE, MOCK_PAYLOADS[ROUTE], requestId);
  const startTime = performance.now();

  try {
    const { object } = await generateObject({
      model: zhipu().chat(MODEL_IDS.zhipuFlash), // Fast model for real-time analysis
      maxRetries: DEFAULT_MAX_RETRIES,
      experimental_repairText: repairZhipuJson,
      system: buildChunkSystem({ context, role, level }),
      schema: ChunkOutputSchema,
      prompt: buildChunkPrompt(text),
      abortSignal: signal,
    });
    const endTime = performance.now();
    logApi(ROUTE, { requestId, status: 200, latencyMs: Math.round(endTime - startTime), model: MODEL_IDS.zhipuFlash });

    return okResponse(object, requestId);

  } catch {
    logApi(ROUTE, { requestId, status: 500, latencyMs: Math.round(performance.now() - startTime), reason: "upstream_error" });
    return errorResponse("UPSTREAM_ERROR", "Failed to analyze chunk", 500, requestId);
  }
}
