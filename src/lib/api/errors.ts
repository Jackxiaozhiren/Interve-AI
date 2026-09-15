// Phase 2 API hardening: standardized error + success envelopes (P0-3).
// Shape: { error: { code, message }, requestId } — never includes bodies/PII.
import { NextResponse } from "next/server";
import { withRequestId } from "./request-id";

export const ERROR_CODES = {
  UNAUTHORIZED: "UNAUTHORIZED",
  BAD_REQUEST: "BAD_REQUEST",
  INVALID_JSON: "INVALID_JSON",
  VALIDATION_FAILED: "VALIDATION_FAILED",
  PAYLOAD_TOO_LARGE: "PAYLOAD_TOO_LARGE",
  RATE_LIMITED: "RATE_LIMITED",
  UPSTREAM_ERROR: "UPSTREAM_ERROR",
  INTERNAL: "INTERNAL",
  CONFIG_MISCONFIGURED: "CONFIG_MISCONFIGURED",
} as const;

export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];

export function errorResponse(
  code: ErrorCode,
  message: string,
  status: number,
  requestId: string,
  extraHeaders?: Record<string, string>
): NextResponse {
  const headers = withRequestId(new Headers(), requestId);
  if (extraHeaders) {
    for (const [k, v] of Object.entries(extraHeaders)) headers.set(k, v);
  }
  return NextResponse.json({ error: { code, message }, requestId }, { status, headers });
}

export function okResponse<T>(
  data: T,
  requestId: string,
  init?: { status?: number; headers?: Record<string, string> }
): NextResponse {
  const headers = withRequestId(new Headers(), requestId);
  if (init?.headers) {
    for (const [k, v] of Object.entries(init.headers)) headers.set(k, v);
  }
  return NextResponse.json(data, { status: init?.status ?? 200, headers });
}
