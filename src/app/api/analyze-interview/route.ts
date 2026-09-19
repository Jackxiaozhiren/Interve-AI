import { generateObject } from "ai";
import { z } from "zod";
import { guardRequest, okResponse, errorResponse } from "@/lib/api/guard";
import { logApi } from "@/lib/api/logging";
import { classifyUpstreamError } from "@/lib/api/classify-error";
import { resolveInterviewModel, FALLBACK_MAX_RETRIES, repairZhipuJson } from "@/ai/providers/registry";
import { withModelFallback } from "@/ai/providers/fallback";
import { isMockEnabled, mockJson, mockV2Evaluation } from "@/ai/providers/mock";
import { RUBRICS, selectRubricId } from "@/ai/rubrics";
import { getInterviewType } from "@/ai/interview/types";
import {
  EVALUATION_VERSION,
  EvaluationV2Schema,
  isThinEvaluationText,
  repairEvaluationText,
  type EvaluationV2,
} from "@/ai/evaluation-contract";
import {
  buildEvaluationSystemPrompt,
  buildEvaluationUserPrompt,
} from "@/ai/prompts/evaluation";

export const runtime = 'nodejs';
export const maxDuration = 170;

const ROUTE = "analyze-interview";

const BodySchema = z.object({
  messages: z.array(z.record(z.string(), z.unknown())).min(1).max(200),
  framework: z.string().max(64).optional(),
  // Phase 7: canonical interview type. Framework keeps precedence for
  // explicit non-general formats (backward compatible with old clients).
  interviewType: z.string().max(64).optional(),
});

export async function POST(req: Request) {
  const gate = await guardRequest(req, {
    route: ROUTE,
    schema: BodySchema,
    maxBytes: 1024 * 1024,
    rateLimit: { limit: 10, windowMs: 60_000 },
    // Measured 2026-09-13 (free glm-4-flash): TTFT ~1s but full V2 eval
    // streams ~70 chars/s, so a short interview needs ~63s end-to-end.
    // nodejs runtime (not edge: edge needs first byte within 25s for
    // long responses) + 170s budget fits Vercel Hobby free max (300s).
    timeoutMs: 170000,
  });
  if (!gate.ok) return gate.response;
  const { requestId, data, signal } = gate.ctx;
  const { messages, framework, interviewType } = data as { messages: unknown[]; framework?: string; interviewType?: string };
  if (isMockEnabled()) return mockJson(ROUTE, mockV2Evaluation(), requestId);
  const startTime = performance.now();

  // Phase 4+7: fixed rubric per interview format. Explicit non-general
  // frameworks keep precedence (old clients); otherwise the canonical
  // interview type selects the rubric; default is general-v1 either way.
  const frameworkRubricId = selectRubricId(framework);
  const rubricId = frameworkRubricId !== "general-v1"
    ? frameworkRubricId
    : getInterviewType(interviewType).rubricId;
  const rubric = RUBRICS[rubricId] ?? RUBRICS["general-v1"];
  const systemPrompt =
    buildEvaluationSystemPrompt(rubric) +
    (rubric.id === "behavioral-v1"
      ? "\n\nSTAR REQUIREMENT: In qaReview flaws, explicitly mark which STAR components were present vs missing (e.g. [S: present] [T: missing] [A: present] [R: missing]) and call out missing components as a major flaw."
      : "") +
    "\n\nProvide all textual analysis and reasoning in Chinese.";
  const prompt = buildEvaluationUserPrompt(messages, framework, rubric);

  try {
    // Cost-aware routing: short interviews use flash, long ones thinking.
    const transcriptLength = JSON.stringify(messages).length;
    const { model: primaryModel, modelId } = resolveInterviewModel(messages.length, transcriptLength);

    const outcome = await withModelFallback({
      route: ROUTE,
      requestId,
      startTime,
      primaryModel,
      primaryModelId: modelId,
      run: async (model, reportUsage) => {
        const result = await generateObject({
          model,
          maxRetries: FALLBACK_MAX_RETRIES,
          abortSignal: signal,
          schema: EvaluationV2Schema,
          // Zhipu chat models ignore json_schema and fence the JSON —
          // repair strips fences, then coerces sloppy types (string scores,
          // empty-evidence pin) WITHOUT relaxing the strict schema.
          experimental_repairText: async ({ text }) => {
            const stripped = await repairZhipuJson({ text });
            const base = stripped ?? text;
            return repairEvaluationText(base) ?? stripped;
          },
          system: systemPrompt,
          prompt,
        });
        // H3.2: flagship-lane token accounting via the helper's log lines.
        reportUsage?.(result.usage);
        return normalizeEvaluation(result.object, rubric.id);
      },
    });
    return okResponse(outcome.value, requestId, outcome.fallback ? { headers: { "x-fallback": outcome.modelId } } : undefined);
  } catch (e) {
    // Thin transcripts (model found nothing quotable in ANY dimension) get a
    // distinct 422 so clients can say "add specifics and retry" instead of a
    // generic failure. Raw text is inspected server-side only, never echoed.
    const rawText = (e as { text?: unknown })?.text;
    if (typeof rawText === "string" && isThinEvaluationText(rawText)) {
      logApi(ROUTE, { requestId, status: 422, latencyMs: Math.round(performance.now() - startTime), reason: "thin_transcript" });
      return errorResponse("THIN_TRANSCRIPT", "Not enough grounded signal to evaluate — add specifics and retry", 422, requestId);
    }
    logApi(ROUTE, { requestId, status: 500, latencyMs: Math.round(performance.now() - startTime), reason: classifyUpstreamError(e) });
    return errorResponse("UPSTREAM_ERROR", "Failed to analyze interview", 500, requestId);
  }
}

/**
 * Server-side normalization (never trust model metadata):
 * - pins version + rubricId to this release,
 * - drops dimensions outside the selected rubric (unknown ids),
 * - keeps partial dimension sets valid (schema allows 1-8; UI shows what
 *   was evaluated). Missing dimensions are a quality signal for Phase 5
 *   evals, not a reason to fail the interview end.
 */
function normalizeEvaluation(raw: EvaluationV2, rubricId: string): EvaluationV2 {
  const allowed = new Set((RUBRICS[rubricId]?.dimensions ?? []).map((d) => d.id));
  return {
    ...raw,
    version: EVALUATION_VERSION,
    rubricId,
    dimensions: raw.dimensions.filter((d) => allowed.size === 0 || allowed.has(d.id)),
  };
}
