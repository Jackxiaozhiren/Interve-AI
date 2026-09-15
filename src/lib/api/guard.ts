// Phase 2 API hardening: uniform per-route gate (P0-3).
//
// Order (fixed): requestId -> rate limit (by IP, pre-auth so anonymous
// floods are bounded) -> session -> body size + Zod validation.
// Anything reaching the AI provider has passed all four checks.
//
// Session model is transitional: HMAC-signed demo cookie (see session.ts).
// The Supabase Auth cutover swaps `requireSession` internals without
// touching call sites.
import { NextResponse } from "next/server";
import { z } from "zod";
import { getRequestId } from "./request-id";
import { errorResponse, okResponse, type ErrorCode } from "./errors";
import { checkRateLimit, getClientIp, type RateLimitRule } from "./rate-limit";
import { readJsonBody } from "./validate";
import { getSessionFromRequest, type SessionPayload } from "./session";
import { logApi } from "./logging";

export interface GuardOptions<T> {
  route: string;
  schema: z.ZodType<T>;
  /** Hard cap for the JSON body in bytes. */
  maxBytes: number;
  rateLimit: RateLimitRule;
  /** Set false only for the session-issuing endpoint. */
  requireSession?: boolean;
  /** Upstream timeout budget in ms (combined with client abort). */
  timeoutMs?: number;
}

export interface GuardContext<T> {
  requestId: string;
  session: SessionPayload;
  data: T;
  /** AbortSignal combining client disconnect + server timeout budget. */
  signal: AbortSignal;
}

function combineSignal(req: Request, timeoutMs: number): AbortSignal {
  const timer = AbortSignal.timeout(timeoutMs);
  const client = req.signal;
  if (typeof AbortSignal.any === "function") {
    return AbortSignal.any([client, timer]);
  }
  return client;
}

export function rateLimitHeaders(remaining: number, resetMs: number): Record<string, string> {
  return {
    "RateLimit-Remaining": String(Math.max(0, remaining)),
    "RateLimit-Reset": String(Math.max(0, Math.ceil(resetMs / 1000))),
  };
}

export async function guardRequest<T>(
  req: Request,
  opts: GuardOptions<T>
): Promise<{ ok: true; ctx: GuardContext<T> } | { ok: false; response: NextResponse }> {
  const requestId = getRequestId(req);
  const startTime = performance.now();
  const done = (status: number, extra?: { model?: string; fallback?: boolean; reason?: string }) =>
    logApi(opts.route, { requestId, status, latencyMs: Math.round(performance.now() - startTime), ...extra });

  // 1. Rate limit (pre-auth).
  const rl = checkRateLimit(opts.route, getClientIp(req), opts.rateLimit);
  if (!rl.allowed) {
    done(429, { reason: "rate_limited" });
    return {
      ok: false,
      response: errorResponse("RATE_LIMITED", "Too many requests. Please retry later.", 429, requestId, {
        "Retry-After": String(Math.max(1, Math.ceil(rl.retryAfterMs / 1000))),
        ...rateLimitHeaders(rl.remaining, rl.resetMs),
      }),
    };
  }

  // 2. Session.
  let session: SessionPayload | null = null;
  if (opts.requireSession !== false) {
    session = await getSessionFromRequest(req);
    if (!session) {
      done(401, { reason: "unauthenticated" });
      return {
        ok: false,
        response: errorResponse("UNAUTHORIZED", "Authentication required. Please sign in.", 401, requestId),
      };
    }
  } else {
    // Session-issuing path still needs a non-null context shape downstream.
    session = { v: 1, id: "", email: "", username: "", iat: 0, exp: 0 };
  }

  // 3+4. Bounded body + Zod validation.
  const body = await readJsonBody(req, opts.schema, opts.maxBytes);
  if (!body.ok) {
    done(body.error.status, { reason: body.error.code.toLowerCase() });
    return {
      ok: false,
      response: errorResponse(body.error.code as ErrorCode, body.error.message, body.error.status, requestId),
    };
  }

  return {
    ok: true,
    ctx: {
      requestId,
      session,
      data: body.data,
      signal: combineSignal(req, opts.timeoutMs ?? 25000),
    },
  };
}

export { okResponse, errorResponse };
