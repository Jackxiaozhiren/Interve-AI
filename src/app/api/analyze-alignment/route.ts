import { generateObject } from 'ai';
import { z } from 'zod';
import { guardRequest, okResponse, errorResponse } from "@/lib/api/guard";
import { logApi } from "@/lib/api/logging";
import { google, MODEL_IDS, DEFAULT_MAX_RETRIES } from "@/ai/providers/registry";
import { isMockEnabled, mockJson, MOCK_PAYLOADS } from "@/ai/providers/mock";
import { buildAlignmentPrompt } from "@/ai/prompts/alignment";
import { evidenceField, confidenceField } from "@/ai/evidence";

// Use edge runtime for faster execution
export const runtime = 'edge';

const ROUTE = "analyze-alignment";

export const AlignmentOutputSchema = z.object({
  matchScore: z.number().min(0).max(100).describe("The overall match score (0-100) based on how well the candidate's skills and experience fit the job description."),
  strengths: z.array(z.string()).describe("A list of 3-5 key strengths or aligned skills the candidate possesses."),
  gaps: z.array(z.string()).describe("A list of 2-4 skill gaps or missing requirements."),
  recommendedFocus: z.string().describe("A concise instruction (max 2 sentences) for the AI interviewer on what topics to drill into based on the candidate's gaps and strengths."),
  // Phase 4 evidence envelope: verbatim quotes grounding strengths/gaps.
  // Optional-with-default so older model outputs and stored rows still validate.
  evidence: evidenceField(6, "2-6 verbatim quotes — JD requirement lines behind each strength/gap plus the resume lines that show or miss them (exact substrings)."),
  confidence: confidenceField("Evaluator confidence = how much usable evidence both documents contained; never candidate psychology."),
});

const BodySchema = z.object({
  resumeText: z.string().min(1).max(60000),
  jobDescription: z.string().min(1).max(60000),
});

export async function POST(req: Request) {
  const gate = await guardRequest(req, {
    route: ROUTE,
    schema: BodySchema,
    maxBytes: 256 * 1024,
    rateLimit: { limit: 20, windowMs: 60_000 },
  });
  if (!gate.ok) return gate.response;
  const { requestId, data, signal } = gate.ctx;
  const { resumeText, jobDescription } = data;
  if (isMockEnabled()) return mockJson(ROUTE, MOCK_PAYLOADS[ROUTE], requestId);
  const startTime = performance.now();

  try {
    const { object } = await generateObject({
      model: google()(MODEL_IDS.geminiFlash),
      maxRetries: DEFAULT_MAX_RETRIES,
      schema: AlignmentOutputSchema,
      prompt: buildAlignmentPrompt({ resumeText, jobDescription }),
      abortSignal: signal,
    });
    const endTime = performance.now();
    logApi(ROUTE, { requestId, status: 200, latencyMs: Math.round(endTime - startTime), model: MODEL_IDS.geminiFlash });

    return okResponse(object, requestId);
  } catch {
    logApi(ROUTE, { requestId, status: 500, latencyMs: Math.round(performance.now() - startTime), reason: "upstream_error" });
    return errorResponse("UPSTREAM_ERROR", "Failed to analyze alignment", 500, requestId);
  }
}
