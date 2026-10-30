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
import { checkUserBudget, defaultUserBudget } from "./user-budget";
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
  /** Phase B6: per-user daily AI-call budget. Default ON (env USER_AI_BUDGET_RPD,
   *  default 200) for every authenticated call; set false to opt a route out. */
  userBudget?: { limit?: number } | false;
}

export interface GuardContext<T> {
  requestId: string;
  session: SessionPayload;
  data: T;
  /** AbortSignal combining client disconnect + server timeout budget. */
  signal: AbortSignal;
  /**
   * What is left of today's allowance *after* this call was counted, or undefined
   * when the route opts out of the budget (`userBudget: false`) or the caller has
   * no session.
   *
   * It is carried on the context, not only on the 429, because a ceiling the user
   * first learns about by hitting it is indistinguishable from a failure. A route
   * that spreads `rateLimitHeaders(quota.remaining, quota.resetMs)` onto its
   * success response lets the client show the number before it reaches zero.
   * Nothing consumes this yet — that is the next unit, and it is why the field is
   * documented here rather than discovered later.
   */
  quota?: { remaining: number; resetMs: number };
}

/**
 * client disconnect ∪ lane timeout, whichever arrives first.
 *
 * Exported because `/api/parse-resume` hand-rolls its pipeline (it reads
 * `formData`, so it cannot go through `guardRequest`) and still has to bound the
 * provider call it makes: without a signal the only timeout in that route is the
 * platform's `maxDuration` kill, which hands the client a body it cannot parse as
 * JSON and records no reason at all. One composition, shared by both shapes of
 * route, rather than a second copy with its own edge semantics.
 */
export function combineSignal(req: Request, timeoutMs: number): AbortSignal {
  // P1-01 (BUG-R-guard-timeout): 手写双信号合成，不依赖 AbortSignal.any。
  // 背景：edge 下 AbortSignal.any 缺失时旧回落直接返回 client 信号，
  // 超时预算被静默丢弃。合成信号 = client 中断 ∪ 超时到期，先到先生效。
  const controller = new AbortController();
  const onAbort = () => {
    clearTimeout(timer);
    controller.abort();
  };
  const timer = setTimeout(onAbort, timeoutMs);
  // 服务端 timer 不得拖住进程退出（edge 无 unref，守卫式调用）。
  const maybeUnref = timer as unknown as { unref?: () => void };
  if (typeof maybeUnref.unref === "function") maybeUnref.unref();
  const client = req.signal;
  if (client.aborted) {
    onAbort();
  } else {
    client.addEventListener("abort", onAbort, { once: true });
  }
  return controller.signal;
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

  // Filled in by step 5 when this caller has a session and a budget. Undefined is
  // meaningful: it means the route opted out, so a client must not render "0 left".
  let quota: { remaining: number; resetMs: number } | undefined;

  // 1. Rate limit (pre-auth).
  const clientIp = getClientIp(req);
  const rl = checkRateLimit(opts.route, clientIp, opts.rateLimit);
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

  // 5. Phase B6: per-caller daily budget (Unbounded Consumption fuse). Only
  // validated, authenticated calls consume budget; malformed/anonymous
  // traffic never does. Over-budget is 429 with Retry-After till PT-midnight
  // rollover — same code clients already handle for IP rate limits.
  //
  // The session id alone cannot serve as the fuse: /api/session mints a cookie
  // for any identity the caller supplies, so a new id is a new allowance. The
  // IP is counted alongside it, which is what makes the ceiling real.
  if (opts.userBudget !== false && session.id) {
    const limit = opts.userBudget?.limit ?? defaultUserBudget();
    const budget = checkUserBudget(opts.route, [session.id, clientIp], limit);
    if (!budget.allowed) {
      done(429, { reason: "user_budget_exceeded" });
      return {
        ok: false,
        response: errorResponse("RATE_LIMITED", "Daily AI budget exceeded. Please retry tomorrow.", 429, requestId, {
          "Retry-After": String(Math.max(1, Math.ceil(budget.resetMs / 1000))),
          ...rateLimitHeaders(budget.remaining, budget.resetMs),
        }),
      };
    }
    quota = { remaining: budget.remaining, resetMs: budget.resetMs };
  }

  return {
    ok: true,
    ctx: {
      requestId,
      session,
      data: body.data,
      signal: combineSignal(req, opts.timeoutMs ?? 25000),
      quota,
    },
  };
}

export { okResponse, errorResponse };
