// Phase 5: uniform primary→fallback execution (previously bespoke in
// interview-chat + analyze-interview with divergent logging/headers).
import type { LanguageModel } from "ai";
import { logApi, usageOf } from "@/lib/api/logging";
import { MODEL_IDS, FALLBACK_MAX_RETRIES } from "./registry";

export interface FallbackRun<T> {
  route: string;
  requestId: string;
  startTime: number;
  primaryModel: LanguageModel;
  primaryModelId: string;
  /** Receives the model to call; must apply signal/retries itself.
   * H3.2: may call `reportUsage(result.usage)` so token accounting rides
   * the helper's own log lines (optional — old single-arg runs unaffected). */
  run: (model: LanguageModel, reportUsage?: (usage: unknown) => void) => Promise<T>;
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
    let usage: unknown;
    const value = await opts.run(opts.primaryModel, (u) => {
      usage = u;
    });
    logApi(opts.route, {
      requestId: opts.requestId,
      status: 200,
      latencyMs: Math.round(performance.now() - opts.startTime),
      model: opts.primaryModelId,
      ...usageOf(usage),
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
    let fbUsage: unknown;
    const value = await opts.run(zhipu().chat(MODEL_IDS.zhipuFlash), (u) => {
      fbUsage = u;
    });
    logApi(opts.route, {
      requestId: opts.requestId,
      status: 200,
      latencyMs: Math.round(performance.now() - fallbackStart),
      model: MODEL_IDS.zhipuFlash,
      fallback: true,
      ...usageOf(fbUsage),
    });
    return { value, modelId: MODEL_IDS.zhipuFlash, fallback: true };
  }
}

export { FALLBACK_MAX_RETRIES };

/**
 * Phase C2: user-visible failure estimate for the primary→fallback chain.
 *
 * If the primary fails with probability p per attempt and the single flash
 * fallback fails with ~the same p, the user sees a failure only when BOTH
 * fail: ≈ p². At the EVAL_REPORT §5 measured p ≈ 3/31 (9.7%), visible ≈
 * 0.9% — a ~10× reduction, clearing the "halve the user-visible 500 rate"
 * bar with margin. Approximation only: common-cause outages (vendor down)
 * break independence and push visible toward p. Planning bound, not an SLO;
 * graduate it with funded-key nightly data (Phase A2 trend JSON).
 */
export function estimateVisibleFailureRate(primaryFailureRate: number): number {
  if (!Number.isFinite(primaryFailureRate) || primaryFailureRate < 0 || primaryFailureRate > 1) {
    throw new Error(`[fallback] primaryFailureRate must be in [0,1], got: ${String(primaryFailureRate)}`);
  }
  return primaryFailureRate * primaryFailureRate;
}
