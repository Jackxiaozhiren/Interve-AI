import { generateText } from "ai";
import { z } from "zod";
import { guardRequest, okResponse, errorResponse } from "@/lib/api/guard";
import { logApi } from "@/lib/api/logging";
import { zhipu, MODEL_IDS, DEFAULT_MAX_RETRIES } from "@/ai/providers/registry";
import { isMockEnabled, mockJson, MOCK_PAYLOADS } from "@/ai/providers/mock";
import { buildVisionText } from "@/ai/prompts/vision";

export const runtime = 'edge';
export const maxDuration = 60;

const ROUTE = "analyze-vision";

// Only data: URLs are accepted: the whiteboard snapshot flow always sends
// PNG data URLs, and refusing remote URLs removes provider-side fetch (SSRF)
// and credential-URL exfiltration vectors entirely.
const BodySchema = z.object({
  imageBase64: z.string()
    .min(32)
    .max(8 * 1024 * 1024)
    .refine((v) => v.startsWith("data:image/"), { message: "imageBase64 must be a data:image/* URL" }),
  problemContext: z.string().max(10000).optional(),
});

export async function POST(req: Request) {
  const gate = await guardRequest(req, {
    route: ROUTE,
    schema: BodySchema,
    maxBytes: 8 * 1024 * 1024 + 32 * 1024,
    rateLimit: { limit: 10, windowMs: 60_000 },
    timeoutMs: 55000,
  });
  if (!gate.ok) return gate.response;
  const { requestId, data, signal } = gate.ctx;
  const { imageBase64, problemContext } = data;
  if (isMockEnabled()) return mockJson(ROUTE, MOCK_PAYLOADS[ROUTE], requestId);
  const startTime = performance.now();

  try {
    const { text } = await generateText({
      model: zhipu().chat(MODEL_IDS.zhipuVision), // Use the most capable vision model
      maxRetries: DEFAULT_MAX_RETRIES,
      abortSignal: signal,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: buildVisionText({ problemContext })
            },
            {
              type: "image",
              image: new URL(imageBase64)
            }
          ]
        }
      ]
    });

    logApi(ROUTE, { requestId, status: 200, latencyMs: Math.round(performance.now() - startTime), model: MODEL_IDS.zhipuVision });
    return okResponse({ feedback: text }, requestId);
  } catch {
    logApi(ROUTE, { requestId, status: 500, latencyMs: Math.round(performance.now() - startTime), reason: "upstream_error" });
    return errorResponse("UPSTREAM_ERROR", "Failed to analyze architecture diagram", 500, requestId);
  }
}
