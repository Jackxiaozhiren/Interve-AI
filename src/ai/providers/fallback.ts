// Phase 5: uniform primary→fallback execution (previously bespoke in
// interview-chat + analyze-interview with divergent logging/headers).
import type { LanguageModel } from "ai";
import { logApi } from "@/lib/api/logging";
import { MODEL_IDS, FALLBACK_MAX_RETRIES } from "./registry";

export interface FallbackRun<T> {
  route: string;
  requestId: string;
  startTime: number;
  primaryModel: LanguageModel;
  primaryModelId: string;
  /** Receives the model to call; must apply signal/retries itself. */
  run: (model: LanguageModel) => Promise<T>;
}

export interface FallbackOutcome<T> {
  value: T;
  modelId: string;
  fallback: boolean;
}

/**
 * Runs primary, then exactly one Zhipu-flash fallback. Observability is
 * uniform: fallback attempts are logged with `fallback: true` and the
 * caller is expected to set the `x-fallback` response header.
 */
export async function withModelFallback<T>(opts: FallbackRun<T>): Promise<FallbackOutcome<T>> {
  try {
    const value = await opts.run(opts.primaryModel);
    logApi(opts.route, {
      requestId: opts.requestId,
      status: 200,
      latencyMs: Math.round(performance.now() - opts.startTime),
      model: opts.primaryModelId,
    });
    return { value, modelId: opts.primaryModelId, fallback: false };
  } catch {
    logApi(opts.route, {
      requestId: opts.requestId,
      status: 200,
      latencyMs: Math.round(performance.now() - opts.startTime),
      model: opts.primaryModelId,
      fallback: true,
    });
    const { zhipu } = await import("./registry");
    const fallbackStart = performance.now();
    const value = await opts.run(zhipu().chat(MODEL_IDS.zhipuFlash));
    logApi(opts.route, {
      requestId: opts.requestId,
      status: 200,
      latencyMs: Math.round(performance.now() - fallbackStart),
      model: MODEL_IDS.zhipuFlash,
      fallback: true,
    });
    return { value, modelId: MODEL_IDS.zhipuFlash, fallback: true };
  }
}

export { FALLBACK_MAX_RETRIES };
