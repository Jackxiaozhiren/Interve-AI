import { streamText, type ModelMessage } from "ai";
import { z } from "zod";
import { guardRequest, errorResponse } from "@/lib/api/guard";
import { logApi, logStreamUsage } from "@/lib/api/logging";
import { classifyUpstreamError } from "@/lib/api/classify-error";
import { resolveChatModel, zhipu, MODEL_IDS, FALLBACK_MAX_RETRIES } from "@/ai/providers/registry";
import { isMockEnabled, mockTextStream, MOCK_STREAMS } from "@/ai/providers/mock";
import { buildInterviewSystemPrompt } from "@/ai/prompts/interview";
import { buildCoverageSection } from "@/ai/prompts/coverage";
import { synthesizeServerState } from "@/ai/interview/state";
import { getInterviewType } from "@/ai/interview/types";

export const runtime = 'edge';
export const maxDuration = 60;

const ROUTE = "interview-chat";

// Input contract mirrors what useChat transports send today. Unknown keys
// are stripped; `model` is length-bounded and unknown values fall through
// to the Zhipu default (same behavior as before, without unbounded input).
const BodySchema = z.object({  messages: z.array(z.object({ role: z.string().min(1).max(32) }).passthrough()).min(1).max(100),
  context: z.string().max(12000).optional(),
  codeContext: z.string().max(12000).optional(),
  systemDesignContext: z.string().max(12000).optional(),
  role: z.string().max(256).optional(),
  level: z.string().max(256).optional(),
  persona: z.string().max(256).optional(),
  stressTest: z.boolean().optional(),
  setupContext: z.string().max(12000).optional(),
  framework: z.string().max(256).optional(),
  company: z.string().max(256).optional(),
  // Phase 7: canonical interview type (setup select). Framework keeps
  // precedence for explicit non-general formats (backward compatible).
  interviewType: z.string().max(64).optional(),
  resumeText: z.string().max(12000).optional(),
  cognitiveLoad: z.number().min(0).max(100).optional(),
  starProgress: z.unknown().optional(),
  behavioralTraits: z.unknown().optional(),
  model: z.string().max(64).optional(),
  // Phase 6: client loop timing (server re-derives authority-side state).
  interviewLoop: z.object({
    startedAt: z.number().int().positive().optional(),
    timeBudgetSec: z.number().int().min(60).max(7200).optional(),
    difficulty: z.string().max(16).optional(),
  }).optional(),
});

export async function POST(req: Request) {
  const gate = await guardRequest(req, {
    route: ROUTE,
    schema: BodySchema,
    maxBytes: 512 * 1024,
    rateLimit: { limit: 30, windowMs: 60_000 },
    timeoutMs: 55000,
  });
  if (!gate.ok) return gate.response;
  const { requestId, data, signal } = gate.ctx;
  const { messages, context, codeContext, systemDesignContext, role, level, persona, stressTest, setupContext, framework, company, resumeText, starProgress, behavioralTraits, model, interviewLoop, interviewType } = data as {
    messages: Array<{ role: string; content?: unknown; parts?: unknown }>;
    context?: string; codeContext?: string; systemDesignContext?: string;
    role?: string; level?: string; persona?: string; stressTest?: boolean;
    setupContext?: string; framework?: string; company?: string; resumeText?: string;
    starProgress?: {
      s: { progress: number; confidence: number; timeSpentSeconds: number };
      t: { progress: number; confidence: number; timeSpentSeconds: number };
      a: { progress: number; confidence: number; timeSpentSeconds: number };
      r: { progress: number; confidence: number; timeSpentSeconds: number };
    } | null;
    behavioralTraits?: { leadership: number; problemSolving: number; communication: number } | null;
    model?: string;
    interviewType?: string;
    interviewLoop?: { startedAt?: number; timeBudgetSec?: number; difficulty?: string };
  };
  if (isMockEnabled()) return mockTextStream(MOCK_STREAMS[ROUTE], requestId);
  const startTime = performance.now();

  try {
    // Model selection logic (centralized in providers/registry; unknown specs
    // fall through to the Zhipu default, as before)
    const { model: selectedModel } = resolveChatModel(model);

    // Context Compression: truncate long inputs to prevent token overflow
    const maxTextLength = 8000;
    const safeTruncate = (str: string) => str?.length > maxTextLength ? str.substring(0, maxTextLength) + "\n...[Content truncated due to length limits]" : str;

    const currentResumeText = safeTruncate(resumeText || "");
    const safeCodeContext = safeTruncate(codeContext || "");
    const safeSystemDesignContext = safeTruncate(systemDesignContext || "");
    const safeContext = safeTruncate(context || "");
    
    // Message Compression: retain only the most recent N messages (e.g., 20) to save context window
    // Cast: transports send UI messages (role/content/parts superset); the
    // provider only reads role + content/parts at runtime.
    const recentMessages = (messages.length > 20 ? messages.slice(-20) : messages) as ModelMessage[];

    // Phase 5: system prompt owned by the versioned registry
    // (src/ai/prompts/interview.ts). Content moved byte-identically.
    let systemPrompt = buildInterviewSystemPrompt({
      role, level, persona, stressTest, framework, company,
      context: safeContext,
      setupContext: setupContext || "",
      resumeText: currentResumeText,
      codeContext: safeCodeContext,
      systemDesignContext: safeSystemDesignContext,
      starProgress: starProgress ?? null,
      behavioralTraits: behavioralTraits ?? null,
    });

    // Phase 7: tooling reminder from the canonical interview type
    // (content-based instruction, not a score or judgment).
    const typeDef = getInterviewType(interviewType);
    if (typeDef.needsCoding) {
      systemPrompt += `\n\n【Tooling note】This is a ${typeDef.name} session: the candidate has a code scratchpad. Ask them to implement, run mental tests, and discuss complexity.`;
    } else if (typeDef.needsWhiteboard) {
      systemPrompt += `\n\n【Tooling note】This is a ${typeDef.name} session: the candidate has a system-design whiteboard. Ask them to draw, narrate trade-offs, and iterate on feedback.`;
    }

    // Phase 6: authoritative loop state, re-derived server-side every turn
    // from the message history (clients can only nudge difficulty ±1).
    const loopState = synthesizeServerState({
      messages,
      level,
      starProgress: starProgress ?? null,
      behavioralTraits: behavioralTraits ?? null,
      startedAt: interviewLoop?.startedAt,
      timeBudgetSec: interviewLoop?.timeBudgetSec,
      difficultyHint: interviewLoop?.difficulty,
    });
    systemPrompt += "\n\n" + buildCoverageSection(loopState);

    // Phase 7 (12.5 intelligent follow-up): observable short-answer probe.
    // Char count only — no psychology. Threshold documented and tested.
    const lastUserMsg = [...messages].reverse().find((m) => m.role === "user");
    if (lastUserMsg) {
      const len = JSON.stringify(lastUserMsg).length;
      if (len > 0 && len < 120) {
        systemPrompt += `\n\n【Follow-up note】The candidate's last answer was very short. Before moving on, ask for one concrete example or number from their experience.`;
      }
    }

    // Phase 3 (Truthfulness Reset): removed cognitive-load-driven pressure
    // modulation. `cognitiveLoad` is an unvalidated heuristic (silence +
    // filler counts), not a psychological measurement, so it must not steer
    // interview pressure (escalation when the candidate seems relaxed,
    // forced gentleness when loaded). Pacing adaptivity belongs to the
    // Phase 4 rubric engine, built on observable signals with evidence.
    // The field remains accepted in the input contract (ignored) to avoid
    // breaking older clients.

    // Try-catch block specifically for model fallback mechanism
    try {
      const startTime = performance.now();
      const result = await streamText({
        model: selectedModel,
        maxRetries: FALLBACK_MAX_RETRIES, // single manual fallback below; keep total attempts bounded
        system: systemPrompt,
        messages: recentMessages,
        abortSignal: signal,
      });
      
      const response = result.toUIMessageStreamResponse();
      const endTime = performance.now();
      logApi(ROUTE, { requestId, status: 200, latencyMs: Math.round(endTime - startTime), model: model || 'zhipu' });
      // H3.2: stream usage resolves post-consumption — deferred line, never blocks.
      logStreamUsage(ROUTE, requestId, model || 'zhipu', result.usage, { started: startTime });
      
      response.headers.set('X-Response-Time', `${(endTime - startTime).toFixed(2)}ms`);
      response.headers.set('x-request-id', requestId);
      return response;
    } catch {
      logApi(ROUTE, { requestId, status: 200, latencyMs: Math.round(performance.now() - startTime), model: model || 'zhipu', fallback: true });
      const fallbackStartTime = performance.now();
      // Fallback model
      const fallbackResult = await streamText({
        model: zhipu().chat(MODEL_IDS.zhipuFlash),
        maxRetries: FALLBACK_MAX_RETRIES,
        system: systemPrompt,
        messages: recentMessages,
        abortSignal: signal,
      });
      const response = fallbackResult.toUIMessageStreamResponse();
      const fallbackEndTime = performance.now();
      logApi(ROUTE, { requestId, status: 200, latencyMs: Math.round(fallbackEndTime - fallbackStartTime), model: MODEL_IDS.zhipuFlash, fallback: true });
      logStreamUsage(ROUTE, requestId, MODEL_IDS.zhipuFlash, fallbackResult.usage, { fallback: true, started: fallbackStartTime });
      response.headers.set('X-Response-Time', `${(fallbackEndTime - fallbackStartTime).toFixed(2)}ms`);
      response.headers.set('x-request-id', requestId);
      response.headers.set('x-fallback', MODEL_IDS.zhipuFlash);
      return response;
    }
  } catch (e) {
    logApi(ROUTE, { requestId, status: 500, latencyMs: Math.round(performance.now() - startTime), reason: classifyUpstreamError(e) });
    return errorResponse("UPSTREAM_ERROR", "Failed to generate interview chat", 500, requestId);
  }
}
