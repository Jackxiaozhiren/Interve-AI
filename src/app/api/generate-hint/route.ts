import { generateText } from "ai";
import { z } from "zod";
import { guardRequest, okResponse, errorResponse } from "@/lib/api/guard";
import { logApi, usageOf } from "@/lib/api/logging";
import { classifyUpstreamError } from "@/lib/api/classify-error";
import { zhipu, MODEL_IDS, DEFAULT_MAX_RETRIES } from "@/ai/providers/registry";
import { isMockEnabled, mockJson, MOCK_PAYLOADS } from "@/ai/providers/mock";
import { buildHintSystem, buildHintPrompt } from "@/ai/prompts/hint";

export const runtime = "edge";

const ROUTE = "generate-hint";

const BodySchema = z.object({
  problemTitle: z.string().max(2000).optional(),
  problemDescription: z.string().max(20000).optional(),
  currentCode: z.string().max(60000).optional(),
  chatHistory: z.string().max(20000).optional(),
}).superRefine((v, ctx) => {
  if (!v.problemTitle && !v.problemDescription && !v.currentCode && !v.chatHistory) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Provide at least one of problemTitle, problemDescription, currentCode, chatHistory" });
  }
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
  const { problemTitle, problemDescription, currentCode, chatHistory } = data;
  if (isMockEnabled()) return mockJson(ROUTE, MOCK_PAYLOADS[ROUTE], requestId);
  const startTime = performance.now();

  try {
    const result = await generateText({
      model: zhipu().chat(MODEL_IDS.zhipuFlash),
      maxRetries: DEFAULT_MAX_RETRIES,
      abortSignal: signal,
      instructions: buildHintSystem({ problemTitle, problemDescription, currentCode }),
      prompt: buildHintPrompt(chatHistory)
    });

    logApi(ROUTE, { requestId, status: 200, latencyMs: Math.round(performance.now() - startTime), model: MODEL_IDS.zhipuFlash, ...usageOf(result.usage) });
    return okResponse({ hint: result.text }, requestId);
  } catch (e) {
    logApi(ROUTE, { requestId, status: 500, latencyMs: Math.round(performance.now() - startTime), reason: classifyUpstreamError(e) });
    return errorResponse("UPSTREAM_ERROR", "Failed to generate hint", 500, requestId);
  }
}
