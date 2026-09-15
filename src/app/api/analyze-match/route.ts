import { generateObject } from "ai";
import { z } from "zod";
import { guardRequest, okResponse, errorResponse } from "@/lib/api/guard";
import { logApi } from "@/lib/api/logging";
import { resolveCostAwareModel, DEFAULT_MAX_RETRIES, repairZhipuJson } from "@/ai/providers/registry";
import { isMockEnabled, mockJson, MOCK_PAYLOADS } from "@/ai/providers/mock";
import { buildMatchPrompt } from "@/ai/prompts/match";
import { evidenceField, confidenceField } from "@/ai/evidence";

export const runtime = 'nodejs';
export const maxDuration = 120;

const ROUTE = "analyze-match";

export const MatchOutputSchema = z.object({
  overallScore: z.number().min(0).max(100),
  alignedSkills: z.array(z.string()),
  missingSkills: z.array(z.string()),
  recommendations: z.array(z.string()),
  // Phase 4 evidence envelope: verbatim quotes grounding the match.
  // Optional-with-default so older model outputs and stored rows still validate.
  evidence: evidenceField(6, "2-6 verbatim quotes — JD requirement lines plus the resume lines that show or miss them (exact substrings)."),
  confidence: confidenceField("Evaluator confidence = how much usable evidence both documents contained; never candidate psychology."),
});

const BodySchema = z.object({
  resumeText: z.string().max(60000).optional().default(""),
  jobDescription: z.string().min(1).max(60000),
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
  const { resumeText, jobDescription } = data;
  if (isMockEnabled()) return mockJson(ROUTE, MOCK_PAYLOADS[ROUTE], requestId);
  const startTime = performance.now();

  try {
    // Cost-aware routing
    const textLength = (resumeText?.length || 0) + jobDescription.length;
    const { model, modelId } = resolveCostAwareModel(textLength);

    const result = await generateObject({
      model,
      maxRetries: DEFAULT_MAX_RETRIES,
      schema: MatchOutputSchema,
      experimental_repairText: repairZhipuJson,
      prompt: buildMatchPrompt({ resumeText, jobDescription }),
      abortSignal: signal,
    });

    logApi(ROUTE, { requestId, status: 200, latencyMs: Math.round(performance.now() - startTime), model: modelId });
    return okResponse({ matchData: result.object }, requestId);
  } catch {
    logApi(ROUTE, { requestId, status: 500, latencyMs: Math.round(performance.now() - startTime), reason: "upstream_error" });
    return errorResponse("UPSTREAM_ERROR", "Failed to analyze match", 500, requestId);
  }
}
