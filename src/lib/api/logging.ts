// Phase 2 API hardening: structured, PII-free API logs (P0-3).
// One JSON line per call: route/requestId/status/latency + cost metadata.
// Bodies, transcripts, resumes and keys are NEVER logged.

export interface ApiLogFields {
  requestId: string;
  status: number;
  latencyMs: number;
  model?: string;
  fallback?: boolean;
  reason?: string;
  // H2.4 token 维度（为 H3.2 per-路由成本账供数）：AI SDK usage 实测，
  // input/output 分开记；缺失（mock/旧路径）即不记，永不编数。
  inputTokens?: number;
  outputTokens?: number;
}

/**
 * H3.2: deferred usage log for `streamText` routes. Stream usage resolves
 * only AFTER the client consumes the stream, so awaiting it on the hot path
 * would delay the response. This attaches a fire-and-forget logger instead:
 * exactly one extra line per stream (marked `stream_usage`), never a second
 * response, never a rejection (swallowed — telemetry must not 500).
 * `latencyMs` here = time until usage resolved ≈ full generation time.
 */
export function logStreamUsage(
  route: string,
  requestId: string,
  model: string,
  // PromiseLike (not Promise): AI SDK v6 streamText exposes usage as a
  // thenable. Promise.resolve adopts it and buys .catch for the swallow.
  usagePromise: PromiseLike<unknown> | undefined,
  opts?: { fallback?: boolean; started?: number }
): void {
  if (!usagePromise || typeof usagePromise.then !== "function") return;
  Promise.resolve(usagePromise).then(
    (usage) => {
      logApi(route, {
        requestId,
        status: 200,
        latencyMs: opts?.started !== undefined ? Math.round(performance.now() - opts.started) : 0,
        model,
        ...(opts?.fallback ? { fallback: true } : {}),
        reason: "stream_usage",
        ...usageOf(usage),
      });
    },
    () => {}
  );
}
/**
 * H2.4: defensively extract token counts from an AI SDK result `usage`
 * (generateObject/generateText/streamText all expose `{ inputTokens,
 * outputTokens }`, but providers may omit it — e.g. mocks). Never throws,
 * never guesses: unshaped input yields `{}`.
 */
export function usageOf(usage: unknown): Pick<ApiLogFields, "inputTokens" | "outputTokens"> {
  if (!usage || typeof usage !== "object") return {};
  const u = usage as Record<string, unknown>;
  const out: Pick<ApiLogFields, "inputTokens" | "outputTokens"> = {};
  if (typeof u.inputTokens === "number" && Number.isFinite(u.inputTokens)) out.inputTokens = u.inputTokens;
  if (typeof u.outputTokens === "number" && Number.isFinite(u.outputTokens)) out.outputTokens = u.outputTokens;
  return out;
}

export function logApi(route: string, fields: ApiLogFields): void {
  const line = JSON.stringify({
    level: fields.status >= 500 ? "error" : fields.status >= 400 ? "warn" : "info",
    route,
    requestId: fields.requestId,
    status: fields.status,
    latencyMs: fields.latencyMs,
    ...(fields.model ? { model: fields.model } : {}),
    ...(fields.fallback ? { fallback: true } : {}),
    ...(fields.reason ? { reason: fields.reason } : {}),
    ...(fields.inputTokens !== undefined ? { inputTokens: fields.inputTokens } : {}),
    ...(fields.outputTokens !== undefined ? { outputTokens: fields.outputTokens } : {}),
  });
  if (fields.status >= 500) console.error(line);
  else console.log(line);
}
