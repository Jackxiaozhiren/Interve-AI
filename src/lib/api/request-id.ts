// Phase 2 API hardening: request IDs (P0-3).
// Edge-compatible (Web Crypto / randomUUID only).

const MAX_REQUEST_ID_LENGTH = 64;

function sanitizeCandidate(raw: string | null): string | null {
  if (!raw) return null;
  const v = raw.trim();
  if (v.length === 0 || v.length > MAX_REQUEST_ID_LENGTH) return null;
  // Allow only trace-safe characters so the ID is safe to echo in headers/logs.
  if (!/^[A-Za-z0-9_-]+$/.test(v)) return null;
  return v;
}

export function getRequestId(req: Request): string {
  return sanitizeCandidate(req.headers.get("x-request-id")) ?? crypto.randomUUID();
}

export function withRequestId(headers: Headers, requestId: string): Headers {
  headers.set("x-request-id", requestId);
  return headers;
}
