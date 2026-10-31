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
import { verifySupabaseToken } from "@/lib/api/verify-supabase-token";
import { getRequestId } from "@/lib/api/request-id";

export const runtime = "edge";

const ROUTE = "session";

// The body no longer carries authority. It is accepted and ignored so an old
// client gets a clean 401 instead of a 400 that reads like a validation bug.
const LoginSchema = z.object({
  id: z.string().max(64).optional(),
  email: z.string().max(254).optional(),
  username: z.string().max(64).optional(),
}).partial();

/**
 * POST /api/session — issues the HMAC-signed session cookie.
 *
 * The identity is taken from a **verified Supabase access token**, never from the
 * request body. Before this change the endpoint accepted any well-formed identity
 * (`LoginSchema` checked the shape, not the ownership), so a caller could mint a
 * cookie for an account they did not control — and the client did exactly that with
 * a `crypto.randomUUID()` id. §15.2 chose Google/GitHub OAuth as the only
 * credential, so this is now the single door, and it opens on proof.
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
  const { requestId } = gate.ctx;

  const authorization = req.headers.get("authorization") ?? "";
  const token = authorization.toLowerCase().startsWith("bearer ")
    ? authorization.slice(7).trim()
    : "";
  const identity = token ? await verifySupabaseToken(token) : null;
  if (!identity) {
    logApi(ROUTE, {
      requestId,
      status: 401,
      latencyMs: Math.round(performance.now() - started),
      reason: token ? "unverified_token" : "no_token",
    });
    return errorResponse(
      "UNAUTHORIZED",
      "Sign-in requires a verified Google or GitHub account.",
      401,
      requestId
    );
  }

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

  const signed = await signSession(
    { id: identity.id, email: identity.email, username: identity.username },
    secret
  );
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
