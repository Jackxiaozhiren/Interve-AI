import { generateObject } from "ai";
import { z } from "zod";
import { guardRequest, okResponse, errorResponse } from "@/lib/api/guard";
import { logApi, usageOf } from "@/lib/api/logging";
import { classifyUpstreamError } from "@/lib/api/classify-error";
import { google, MODEL_IDS, DEFAULT_MAX_RETRIES } from "@/ai/providers/registry";
import { isMockEnabled, mockJson, MOCK_PAYLOADS } from "@/ai/providers/mock";
import { buildCodePrompt } from "@/ai/prompts/code";

export const AnalyzeCodeSchema = z.object({
  timeComplexity: z.string().describe("The time complexity of the code, e.g., O(n), O(n^2)."),
  spaceComplexity: z.string().describe("The space complexity of the code, e.g., O(1), O(n)."),
  issues: z.array(z.string()).describe("Any critical bugs or logic issues in the code."),
  hints: z.array(z.string()).describe("Hints for how to optimize the complexity or improve the code."),
  isOptimal: z.boolean().describe("Whether the code is optimal for typical technical interviews.")
});

export const runtime = 'edge';

const ROUTE = "analyze-code";

const BodySchema = z.object({
  code: z.string().min(1).max(60000),
  language: z.string().max(64).optional(),
  problemStatement: z.string().max(10000).optional(),
});

export async function POST(req: Request) {
  const gate = await guardRequest(req, {
    route: ROUTE,
    schema: BodySchema,
    maxBytes: 128 * 1024,
    rateLimit: { limit: 30, windowMs: 60_000 },
  });
  if (!gate.ok) return gate.response;
  const { requestId, data, signal } = gate.ctx;
  const { code, language, problemStatement } = data;
  if (isMockEnabled()) return mockJson(ROUTE, MOCK_PAYLOADS[ROUTE], requestId);
  const startTime = performance.now();

  try {
    if (!code || code.trim().length === 0) {
      return okResponse({
        timeComplexity: "O(1)",
        spaceComplexity: "O(1)",
        issues: [],
        hints: ["Start writing code to get real-time feedback."],
        isOptimal: false
      }, requestId);
    }

    const { object, usage } = await generateObject({
      model: google()(MODEL_IDS.geminiFlash),
      schema: AnalyzeCodeSchema,
      prompt: buildCodePrompt({ code, language, problemStatement }),
      temperature: 0.1, // Added for faster, deterministic output with lower latency
      maxRetries: DEFAULT_MAX_RETRIES,
      abortSignal: signal,
    });

    logApi(ROUTE, { requestId, status: 200, latencyMs: Math.round(performance.now() - startTime), model: MODEL_IDS.geminiFlash, ...usageOf(usage) });
    return okResponse(object, requestId, {
      headers: {
        "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
      },
    });
  } catch (e) {
    logApi(ROUTE, { requestId, status: 500, latencyMs: Math.round(performance.now() - startTime), reason: classifyUpstreamError(e) });
    return errorResponse("UPSTREAM_ERROR", "Failed to analyze code.", 500, requestId);
  }
}
