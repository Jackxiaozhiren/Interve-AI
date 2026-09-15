import { generateObject } from 'ai';
import { z } from 'zod';
import { guardRequest, okResponse, errorResponse } from "@/lib/api/guard";
import { logApi } from "@/lib/api/logging";
import { resolveCostAwareModel, FALLBACK_MAX_RETRIES, repairZhipuJson } from "@/ai/providers/registry";
import { isMockEnabled, mockTextStream, MOCK_STREAMS } from "@/ai/providers/mock";
import { buildContextSystem, buildContextPrompt } from "@/ai/prompts/context";

// Buffered generateObject completes before first byte → nodejs (edge needs
// first byte within 25s for long responses). Budget fits Vercel Hobby free max.
export const runtime = 'nodejs';
export const maxDuration = 120;

const ROUTE = "init-context";

const BodySchema = z.object({
  jobDescription: z.string().min(1).max(60000),
  resumeContext: z.string().min(1).max(60000),
});

// Output contract (exported for mock validation + future eval harness).
export const InitContextOutputSchema = z.object({
  cheatsheet: z.array(z.string()).describe('List of 5-7 bullet points summarizing key requirements and qualifications from the JD matched against the resume.'),
  topPredictions: z.array(
    z.object({
      question: z.string().describe('Predicted interview question based on JD and Resume'),
      rationale: z.string().describe('Why this question is likely to be asked'),
      keyPointsToHit: z.array(z.string()).describe('Key points the candidate should cover in the answer'),
    })
  ).length(5).describe('Top 5 most likely interview questions'),
});

export async function POST(req: Request) {
  const gate = await guardRequest(req, {
    route: ROUTE,
    schema: BodySchema,
    maxBytes: 256 * 1024,
    rateLimit: { limit: 20, windowMs: 60_000 },
    // Measured 2026-09-13: free glm-4-flash streams ~50 chars/s.
    timeoutMs: 110000,
  });
  if (!gate.ok) return gate.response;
  const { requestId, data, signal } = gate.ctx;
  const { jobDescription, resumeContext } = data;
  if (isMockEnabled()) return mockTextStream(MOCK_STREAMS[ROUTE], requestId);
  const startTime = performance.now();

  try {
    // Cost-aware routing: determine complexity by input length
    const totalLength = jobDescription.length + resumeContext.length;
    const { model, modelId } = resolveCostAwareModel(totalLength);

    // Phase 14: generateObject (complete JSON) instead of streamObject:
    // StreamObjectResult has no UI-message stream response in ai v6, and
    // the text stream it did emit is unparseable by chat transports — the
    // same P0 class fixed in interview-chat. No callers exist (verified),
    // so the complete-object shape is strictly more usable.
    const { object } = await generateObject({
      model,
      schema: InitContextOutputSchema,
      experimental_repairText: repairZhipuJson,
      system: buildContextSystem(),
      prompt: buildContextPrompt({ jobDescription, resumeContext }),
      temperature: 1.0,
      maxRetries: FALLBACK_MAX_RETRIES,
      abortSignal: signal,
    });

    logApi(ROUTE, { requestId, status: 200, latencyMs: Math.round(performance.now() - startTime), model: modelId });
    return okResponse(object, requestId);
  } catch {
    logApi(ROUTE, { requestId, status: 500, latencyMs: Math.round(performance.now() - startTime), reason: "upstream_error" });
    return errorResponse("UPSTREAM_ERROR", "Failed to generate context", 500, requestId);
  }
}
