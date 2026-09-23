import { generateObject } from 'ai';
import { z } from 'zod';
import { guardRequest, okResponse, errorResponse } from "@/lib/api/guard";
import { logApi, usageOf } from "@/lib/api/logging";
import { classifyUpstreamError } from "@/lib/api/classify-error";
import { google, MODEL_IDS, DEFAULT_MAX_RETRIES } from "@/ai/providers/registry";
import { isMockEnabled, mockJson, MOCK_PAYLOADS } from "@/ai/providers/mock";
import { buildJdSystem, buildJdPrompt } from "@/ai/prompts/jd";

export const maxDuration = 60; // 60 seconds
export const runtime = 'edge';

const ROUTE = "parse-jd";

export const ParseJdOutputSchema = z.object({
  title: z.string().describe("A concise, derived title for this assessment based on the JD (e.g., 'Senior Frontend Engineer Assessment')"),
  questions: z.array(z.object({
    question: z.string().describe("The interview question text"),
    rationale: z.string().describe("Why this question is relevant to the JD"),
    expectedSkills: z.array(z.string()).describe("List of keywords or skills to listen for in a good answer")
  }))
});

const BodySchema = z.object({
  jobDescription: z.string().min(1).max(60000),
  // Bounded: previously client-controlled without limit (cost-abuse vector).
  questionCount: z.number().int().min(1).max(20).optional().default(5),
});

export async function POST(req: Request) {
  const gate = await guardRequest(req, {
    route: ROUTE,
    schema: BodySchema,
    maxBytes: 256 * 1024,
    rateLimit: { limit: 20, windowMs: 60_000 },
    timeoutMs: 55000,
  });
  if (!gate.ok) return gate.response;
  const { requestId, data, signal } = gate.ctx;
  const { jobDescription, questionCount } = data;
  if (isMockEnabled()) return mockJson(ROUTE, MOCK_PAYLOADS[ROUTE], requestId);
  const startTime = performance.now();

  try {
    const { object, usage } = await generateObject({
      model: google()(MODEL_IDS.geminiFlash),
      maxRetries: DEFAULT_MAX_RETRIES,
      instructions: buildJdSystem({ jobDescription, questionCount }),
      schema: ParseJdOutputSchema,
      prompt: buildJdPrompt(jobDescription),
      abortSignal: signal,
    });

    logApi(ROUTE, { requestId, status: 200, latencyMs: Math.round(performance.now() - startTime), model: MODEL_IDS.geminiFlash, ...usageOf(usage) });
    return okResponse(object, requestId);

  } catch (e) {
    logApi(ROUTE, { requestId, status: 500, latencyMs: Math.round(performance.now() - startTime), reason: classifyUpstreamError(e) });
    return errorResponse("UPSTREAM_ERROR", "Failed to parse JD", 500, requestId);
  }
}
