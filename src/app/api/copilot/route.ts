import { generateText } from "ai";
import { z } from "zod";
import { guardRequest, okResponse, errorResponse } from "@/lib/api/guard";
import { logApi, usageOf } from "@/lib/api/logging";
import { classifyUpstreamError } from "@/lib/api/classify-error";
import { resolveCopilotModel, DEFAULT_MAX_RETRIES } from "@/ai/providers/registry";
import { isMockEnabled, mockJson, MOCK_PAYLOADS } from "@/ai/providers/mock";
import { buildCopilotSystem } from "@/ai/prompts/copilot";

export const runtime = "edge";

const ROUTE = "copilot";

const BodySchema = z.object({
  question: z.string().min(1).max(8000),
  resumeSnippets: z.array(z.string().max(8000)).max(20).optional().default([]),
  // Length-bounded only: unknown values fall through to the Zhipu default.
  model: z.string().max(64).optional(),
});

export const HintsOutputSchema = z.array(z.string());

export async function POST(req: Request) {
  const gate = await guardRequest(req, {
    route: ROUTE,
    schema: BodySchema,
    maxBytes: 128 * 1024,
    rateLimit: { limit: 30, windowMs: 60_000 },
  });
  if (!gate.ok) return gate.response;
  const { requestId, data, signal } = gate.ctx;
  const { question, resumeSnippets, model } = data;
  if (isMockEnabled()) return mockJson(ROUTE, MOCK_PAYLOADS[ROUTE], requestId);
  const startTime = performance.now();

  try {
    const { model: selectedModel, modelId } = resolveCopilotModel(model);

    const result = await generateText({
      model: selectedModel,
      maxRetries: DEFAULT_MAX_RETRIES,
      abortSignal: signal,
      instructions: buildCopilotSystem({ question, resumeSnippets }),
      prompt: "Generate the JSON array of hints."
    });

    let hints: string[] = [];
    try {
      let text = result.text.trim();
      if (text.startsWith("```")) {
        text = text.replace(/^```json/i, '').replace(/^```/i, '').replace(/```$/i, '').trim();
      }
      const parsed: unknown = JSON.parse(text);
      const checked = HintsOutputSchema.safeParse(parsed);
      if (checked.success) {
        hints = checked.data;
      } else if (Array.isArray(parsed)) {
        // Coerce: keep string items so one malformed item cannot poison all.
        hints = parsed.filter((h): h is string => typeof h === "string");
      } else {
        hints = [String(parsed)];
      }
    } catch {
      logApi(ROUTE, { requestId, status: 200, latencyMs: Math.round(performance.now() - startTime), model: modelId, reason: "json_coerced" });
      hints = result.text.split('\n').filter(l => l.trim().length > 0).map(l => l.replace(/^[-*•]\s*/, '').replace(/^"|"$/g, ''));
    }

    logApi(ROUTE, { requestId, status: 200, latencyMs: Math.round(performance.now() - startTime), model: modelId, ...usageOf(result.usage) });
    return okResponse({ hints }, requestId);
  } catch (e) {
    logApi(ROUTE, { requestId, status: 500, latencyMs: Math.round(performance.now() - startTime), reason: classifyUpstreamError(e) });
    return errorResponse("UPSTREAM_ERROR", "Failed to generate copilot hints", 500, requestId);
  }
}
