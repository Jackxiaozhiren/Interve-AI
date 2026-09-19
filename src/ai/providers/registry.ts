// Phase 5: centralized AI provider registry.
//
// Before: 11 route files each constructed their own client
// (`createOpenAI` + unofficial `compatibility` flag + baseURL + key),
// hardcoded model IDs in 13 files, and copy-pasted the
// `thinking`/`max_tokens` fetch hack in 4 files.
// After: exactly ONE construction site per vendor, ONE model-id table,
// ONE retry policy. Routes import from here; a static test enforces it.

import { createOpenAI, type OpenAIProvider } from "@ai-sdk/openai";
import { google as googleDefault } from "@ai-sdk/google";
import type { LanguageModel } from "ai";

/** Canonical model ids. Nothing outside this file may hardcode one. */
export const MODEL_IDS = {
  zhipuFlash: "glm-4-flash",
  zhipuThinking: "glm-4.7-flash",
  zhipuVision: "glm-4v-plus",
  zhipuVisionFlash: "glm-4v-flash",
  geminiFlash: "gemini-2.5-flash",
  geminiPro15: "gemini-1.5-pro",
  geminiFlash15: "gemini-1.5-flash",
  gpt4oMini: "gpt-4o-mini",
  gpt4o: "gpt-4o",
  // OpenRouter free tier (OpenAI-compatible, $0). Opt-in only via
  // `?model=openrouter` — never the default (free models rotate + rate-limit).
  // Verified 2026-09-19 against https://openrouter.ai/api/v1/models:
  // ultra = text-only free-form chat (NO vision, NO response_format — do NOT
  // use for generateObject eval lanes); deepseek = structured-output candidate
  // (supports response_format + structured_outputs, 1M ctx).
  openrouterChat: "nvidia/nemotron-3-ultra-550b-a55b:free",
  openrouterStructured: "deepseek/deepseek-v4-flash-0731:free",
} as const;

export const DEFAULT_MAX_RETRIES = 2;
/** Where a manual fallback exists, keep total attempts bounded. */
export const FALLBACK_MAX_RETRIES = 1;

/**
 * Injects Zhipu thinking parameters for the thinking model only.
 * (Single copy of the previously quadruplicated fetch hack.)
 */
async function thinkingFetch(url: string | URL | Request, options?: RequestInit): Promise<Response> {
  const body = options?.body;
  if (typeof body === "string") {
    try {
      const parsed = JSON.parse(body) as { model?: string; thinking?: unknown; max_tokens?: number };
      if (parsed.model === MODEL_IDS.zhipuThinking) {
        parsed.thinking = { type: "enabled" };
        parsed.max_tokens = 65536;
        return fetch(url, { ...options, body: JSON.stringify(parsed) });
      }
    } catch {
      // Fall through with the original body on parse failure.
    }
  }
  return fetch(url, options);
}

let zhipuClient: OpenAIProvider | null = null;
/** Singleton Zhipu (OpenAI-compatible) client. */
export function zhipu(): OpenAIProvider {
  if (!zhipuClient) {
    zhipuClient = createOpenAI({
      // @ts-expect-error - compatibility flag needed for Zhipu AI provider
      compatibility: "compatible",
      baseURL: process.env.OPENAI_BASE_URL || "https://open.bigmodel.cn/api/paas/v4/",
      apiKey: process.env.ZHIPU_API_KEY,
      fetch: thinkingFetch,
    });
  }
  return zhipuClient;
}

type GoogleDefault = typeof googleDefault;
let googleClient: GoogleDefault | null = null;
export function google(): GoogleDefault {
  if (!googleClient) googleClient = googleDefault;
  return googleClient;
}

let openaiClient: OpenAIProvider | null = null;
export function openai(): OpenAIProvider {
  if (!openaiClient) {
    openaiClient = createOpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return openaiClient;
}

let openrouterClient: OpenAIProvider | null = null;
/**
 * Singleton OpenRouter (OpenAI-compatible) client. Server-only key
 * (`OPENROUTER_API_KEY`, never `NEXT_PUBLIC_*`). Without it, only the
 * explicit `?model=openrouter*` opt-in fails closed at call time — keyless
 * CI/build never touches the network. NOTE: must use `.chat()` — the
 * callable default is the Responses API (/responses), which OpenRouter's
 * OpenAI-compatible endpoint does not serve for these models.
 */
export function openrouter(): OpenAIProvider {
  if (!openrouterClient) {
    openrouterClient = createOpenAI({
      baseURL: "https://openrouter.ai/api/v1",
      apiKey: process.env.OPENROUTER_API_KEY,
      headers: {
        "HTTP-Referer":
          process.env.OPENROUTER_SITE_URL ?? "https://github.com/Jackxiaozhiren/Interve-AI",
        "X-Title": "Interve AI",
      },
    });
  }
  return openrouterClient;
}

/** Test hook: drops singletons so env changes take effect. */
export function resetProviderClients(): void {
  zhipuClient = null;
  googleClient = null;
  openaiClient = null;
  openrouterClient = null;
}

export type ChatModelSpec = "openai" | "gemini" | string | undefined;

/**
 * Centralized chat-model resolution (previously duplicated in
 * interview-chat + copilot with drift). Unknown specs fall through to the
 * Zhipu default — same behavior as before, without unbounded input.
 *
 * OpenRouter opt-ins (free tier, explicit only):
 * - "openrouter" → Nemotron Ultra free-form chat (interview-chat/copilot).
 *   Text-only + no response_format: never use for generateObject eval lanes.
 * - "openrouter-structured" → DeepSeek structured-output candidate for
 *   future eval-lane trials (supports response_format + structured_outputs).
 */
export function resolveChatModel(spec: ChatModelSpec): { model: LanguageModel; modelId: string } {
  if (spec === "openai") {
    return { model: openai().chat(MODEL_IDS.gpt4o), modelId: MODEL_IDS.gpt4o };
  }
  if (spec === "gemini") {
    // NOTE: interview-chat historically used gemini-1.5-pro here while
    // copilot used gemini-1.5-flash. Callers now pass the variant they need
    // via resolveChatModelVariant(); this default preserves interview-chat.
    return { model: google()(MODEL_IDS.geminiPro15), modelId: MODEL_IDS.geminiPro15 };
  }
  if (spec === "openrouter") {
    return { model: openrouter().chat(MODEL_IDS.openrouterChat), modelId: MODEL_IDS.openrouterChat };
  }
  if (spec === "openrouter-structured") {
    return { model: openrouter().chat(MODEL_IDS.openrouterStructured), modelId: MODEL_IDS.openrouterStructured };
  }
  return { model: zhipu().chat(MODEL_IDS.zhipuThinking), modelId: MODEL_IDS.zhipuThinking };
}

/** Copilot default (gemini flash variant), preserved from its route. */
export function resolveCopilotModel(spec: ChatModelSpec): { model: LanguageModel; modelId: string } {
  if (spec === "openai") {
    return { model: openai().chat(MODEL_IDS.gpt4oMini), modelId: MODEL_IDS.gpt4oMini };
  }
  if (spec === "gemini") {
    return { model: google()(MODEL_IDS.geminiFlash15), modelId: MODEL_IDS.geminiFlash15 };
  }
  return { model: zhipu().chat(MODEL_IDS.zhipuFlash), modelId: MODEL_IDS.zhipuFlash };
}

/**
 * Practice-eval model resolution. Default stays Gemini flash (validated
 * lane — practice 5/5 green on EVAL_REPORT §5/§5.1). Explicit
 * "openrouter-structured" opts into the DeepSeek free structured-output
 * candidate for MVVP trials only — never default (free rotation +
 * rate-limit + third-party routing). Unknown specs fall through to default.
 */
export function resolvePracticeModel(spec: ChatModelSpec): { model: LanguageModel; modelId: string } {
  if (spec === "openrouter-structured") {
    return { model: openrouter().chat(MODEL_IDS.openrouterStructured), modelId: MODEL_IDS.openrouterStructured };
  }
  return { model: google()(MODEL_IDS.geminiFlash), modelId: MODEL_IDS.geminiFlash };
}

/** Cost-aware Zhipu routing (previously triplicated with drift). */
export function resolveCostAwareModel(charLength: number): { model: LanguageModel; modelId: string } {
  const modelId = charLength > 2000 ? MODEL_IDS.zhipuThinking : MODEL_IDS.zhipuFlash;
  // NOTE: must use .chat() — the callable default is the Responses API
  // (/responses), which Zhipu's OpenAI-compatible endpoint does not implement
  // (404). Live-verified 2026-09-13 with a free key.
  return { model: zhipu().chat(modelId), modelId };
}

/** Interview-eval routing: long OR many-turn interviews use thinking. */
export function resolveInterviewModel(messageCount: number, charLength: number): { model: LanguageModel; modelId: string } {
  return resolveCostAwareModel(messageCount > 8 || charLength > 2000 ? 2001 : 0);
}

/**
 * Live-verified 2026-09-13 (free Zhipu key): glm-4-flash via chat-completions
 * ignores `response_format: json_schema` and returns markdown-fenced pseudo-code
 * (e.g. ```python\nresult = {...}\n```), which fails generateObject parsing.
 * This strips one fence layer + one `name = ...` assignment prefix so the
 * repair pass receives bare JSON. Pure function, no prompt bytes change.
 */
export function stripJsonFences(text: string): string {
  let out = text.trim();
  const fence = out.match(/```[\w+-]*\s*\n?([\s\S]*?)\n?```/);
  if (fence) out = fence[1].trim();
  const assign = out.match(/^[A-Za-z_$][\w$]*\s*=\s*([\s\S]*)$/);
  if (assign && /^[{[]/.test(assign[1].trim())) out = assign[1].trim();
  return out;
}

/**
 * `repairText` for generateObject on Zhipu chat models. Returns the repaired
 * text when stripping changed something, else null (genuinely unparseable —
 * let the error propagate to the route's fallback/error path).
 */
export async function repairZhipuJson({ text }: { text: string }): Promise<string | null> {
  const repaired = stripJsonFences(text);
  return repaired === text ? null : repaired;
}
