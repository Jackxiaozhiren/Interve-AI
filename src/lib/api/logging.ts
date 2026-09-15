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
  });
  if (fields.status >= 500) console.error(line);
  else console.log(line);
}
