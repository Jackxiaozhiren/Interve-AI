import { generateText } from "ai";
import { z } from "zod";
import { guardRequest, okResponse } from "@/lib/api/guard";
import { logApi } from "@/lib/api/logging";
import { zhipu, MODEL_IDS, DEFAULT_MAX_RETRIES } from "@/ai/providers/registry";
import { isMockEnabled, mockJson, MOCK_PAYLOADS } from "@/ai/providers/mock";
import { buildTrendsPrompt } from "@/ai/prompts/trends";

export const runtime = "edge";

const ROUTE = "analyze-trends";

export const TrendsOutputSchema = z.object({
  recurringFlaws: z.array(z.string()),
  keyStrengths: z.array(z.string()),
  growthActionPlan: z.string(),
});

const BodySchema = z.object({
  sessions: z.array(z.record(z.string(), z.unknown())).min(1).max(50),
});

const fallbackData = {
  recurringFlaws: ["Need more data to identify patterns"],
  keyStrengths: ["Need more data to identify strengths"],
  growthActionPlan: "Complete more interviews to generate a personalized trend analysis."
};

export async function POST(req: Request) {
  const startTime = performance.now();
  const gate = await guardRequest(req, {
    route: ROUTE,
    schema: BodySchema,
    maxBytes: 512 * 1024,
    rateLimit: { limit: 10, windowMs: 60_000 },
    timeoutMs: 55000,
  });
  if (!gate.ok) return gate.response;
  const { requestId, data, signal } = gate.ctx;
  const { sessions } = data;
  if (isMockEnabled()) return mockJson(ROUTE, MOCK_PAYLOADS[ROUTE], requestId);

  try {
    // Phase 4: prefer V2 evaluation fields, fall back to legacy rows.
    const sessionData = (sessions as Array<Record<string, unknown>>).map((s, index: number) => {
      const qaReview = s["qaReview"];
      const councilDebate = s["councilDebate"] as
        | { technicalAdvisor?: { reasoning?: unknown }; hrAdvisor?: { reasoning?: unknown }; cultureFitAdvisor?: { reasoning?: unknown } }
        | undefined;
      const evaluationV2 = s["evaluationV2"] as
        | { readiness?: unknown; readinessRationale?: unknown; dimensions?: Array<{ id?: unknown; score?: unknown; rationale?: unknown; improvement?: unknown }> }
        | undefined;
      return {
        sessionIndex: index + 1,
        title: s["title"],
        verdict: evaluationV2?.readiness ?? s["hireVerdict"],
        flaws: Array.isArray(qaReview)
          ? qaReview.map((qa) => (qa as { flaws?: unknown }).flaws).filter(Boolean)
          : [],
        weaknesses: evaluationV2?.dimensions?.map((d) => d.improvement).filter(Boolean) ?? [],
        councilReasoning: councilDebate ? [
          councilDebate.technicalAdvisor?.reasoning,
          councilDebate.hrAdvisor?.reasoning,
          councilDebate.cultureFitAdvisor?.reasoning,
        ] : []
      };
    });

    try {
      const result = await generateText({
        model: zhipu().chat(MODEL_IDS.zhipuFlash),
        maxRetries: DEFAULT_MAX_RETRIES,
        abortSignal: signal,
        prompt: buildTrendsPrompt(sessions.length, JSON.stringify(sessionData, null, 2)),
      });

      // Try to parse the text as JSON, sometimes LLMs add markdown wrapping
      let jsonText = result.text.trim();
      if (jsonText.startsWith('```json')) {
        jsonText = jsonText.slice(7, -3).trim();
      } else if (jsonText.startsWith('```')) {
        jsonText = jsonText.slice(3, -3).trim();
      }

      // Behavior preserved: malformed model output degrades to fallbackData
      // (HTTP 200). Now validated with Zod instead of ad-hoc checks.
      let body = fallbackData;
      try {
        body = TrendsOutputSchema.parse(JSON.parse(jsonText));
      } catch {
        logApi(ROUTE, { requestId, status: 200, latencyMs: Math.round(performance.now() - startTime), model: MODEL_IDS.zhipuFlash, reason: "output_coerced" });
      }

      const latency = (performance.now() - startTime).toFixed(2);
      logApi(ROUTE, { requestId, status: 200, latencyMs: Math.round(performance.now() - startTime), model: MODEL_IDS.zhipuFlash });

      return okResponse(body, requestId, {
        headers: { "X-Response-Time": `${latency}ms` },
      });
      
    } catch {
      logApi(ROUTE, { requestId, status: 200, latencyMs: Math.round(performance.now() - startTime), model: MODEL_IDS.zhipuFlash, reason: "fallback" });
      return okResponse(fallbackData, requestId, {
        headers: { "X-Response-Time": `${(performance.now() - startTime).toFixed(2)}ms` },
      });
    }

  } catch {
    // Behavior preserved: request-level failures also degrade to fallbackData.
    logApi(ROUTE, { requestId, status: 200, latencyMs: Math.round(performance.now() - startTime), reason: "fallback" });
    return okResponse(fallbackData, requestId, {
      headers: { "X-Response-Time": `${(performance.now() - startTime).toFixed(2)}ms` },
    });
  }
}
