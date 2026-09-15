import { z } from "zod";
import { guardRequest, okResponse, errorResponse } from "@/lib/api/guard";
import {
  getSessionSecret,
  isDevFallbackSecret,
  signSession,
  getSessionFromRequest,
  sessionCookieHeader,
  clearSessionCookieHeader,
} from "@/lib/api/session";
import { logApi } from "@/lib/api/logging";
import { getRequestId } from "@/lib/api/request-id";

export const runtime = "edge";

const ROUTE = "session";

const LoginSchema = z.object({
  id: z.string().uuid().max(64),
  email: z.string().email().max(254),
  username: z.string().min(1).max(64),
});

/**
 * POST /api/session — issues the HMAC-signed session cookie.
 * Demo auth (no password store yet): accepts a well-formed identity and
 * binds it to an unforgeable cookie. Credential verification arrives with
 * the Supabase Auth cutover (STABILIZATION_REPORT).
 */
export async function POST(req: Request) {
  const started = performance.now();
  const gate = await guardRequest(req, {
    route: ROUTE,
    schema: LoginSchema,
    maxBytes: 4 * 1024,
    rateLimit: { limit: 30, windowMs: 60_000 },
    requireSession: false,
  });
  if (!gate.ok) return gate.response;
  const { requestId, data } = gate.ctx;

  const secret = getSessionSecret();
  if (!secret) {
    logApi(ROUTE, { requestId, status: 500, latencyMs: Math.round(performance.now() - started), reason: "missing_secret" });
    return errorResponse(
      "CONFIG_MISCONFIGURED",
      "Server session is not configured.",
      500,
      requestId
    );
  }
  if (isDevFallbackSecret(secret)) {
    console.warn("[session] SESSION_SECRET is not set; using dev-only fallback. Set SESSION_SECRET in production.");
  }

  const signed = await signSession({ id: data.id, email: data.email, username: data.username }, secret);
  const secure = process.env.NODE_ENV === "production";
  logApi(ROUTE, { requestId, status: 200, latencyMs: Math.round(performance.now() - started) });
  return okResponse({ ok: true }, requestId, {
    headers: { "Set-Cookie": sessionCookieHeader(signed, secure) },
  });
}

/** GET /api/session — own-session introspection (no PII beyond caller's own). */
export async function GET(req: Request) {
  const requestId = getRequestId(req);
  const session = await getSessionFromRequest(req);
  if (!session || !session.id) {
    return okResponse({ authenticated: false }, requestId, { status: 401 });
  }
  return okResponse(
    { authenticated: true, user: { id: session.id, email: session.email, username: session.username } },
    requestId
  );
}

/** DELETE /api/session — clears the session cookie. */
export async function DELETE(req: Request) {
  const requestId = getRequestId(req);
  return okResponse({ ok: true }, requestId, { headers: { "Set-Cookie": clearSessionCookieHeader() } });
}
