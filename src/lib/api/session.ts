// Phase 2 API hardening: HMAC-signed sessions (P0-3, P1-2).
//
// Why: the legacy `interveai_user` cookie is plain JSON — anyone can forge
// `{"id":"..."}` and bypass the proxy gate. These helpers sign the cookie
// with SESSION_SECRET (HMAC-SHA-256, WebCrypto => edge-compatible).
// Legacy unsigned cookies fail verification and require one re-login.
//
// Transition: Supabase Auth cutover (Phase 3) replaces this mechanism; the
// signed envelope keeps the same cookie name so no client migration is needed.

export const SESSION_COOKIE = "interveai_user";
export const SESSION_TTL_MS = 24 * 60 * 60 * 1000;

// Deterministic dev fallback. NEVER use in production: production without
// SESSION_SECRET fails closed (see resolveSessionSecret).
const DEV_FALLBACK_SECRET = "interveai-dev-only-secret-do-not-use-in-production";

export interface SessionPayload {
  v: 1;
  id: string;
  email: string;
  username: string;
  iat: number;
  exp: number;
}

function b64urlEncode(bytes: Uint8Array): string {
  let s = "";
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function b64urlDecode(s: string): Uint8Array {
  const padded = s.replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(padded);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function constantTimeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

async function importHmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
}

/** Returns the configured secret, or null when production is misconfigured. */
export function getSessionSecret(): string | null {
  const env = process.env.SESSION_SECRET;
  if (env && env.length >= 16) return env;
  if (process.env.NODE_ENV === "production") return null;
  if (env && env.length > 0 && env.length < 16) {
    // Too-short secrets are rejected everywhere (weak HMAC key).
    return null;
  }
  return DEV_FALLBACK_SECRET;
}

export function isDevFallbackSecret(secret: string): boolean {
  return secret === DEV_FALLBACK_SECRET;
}

export async function signSession(
  data: { id: string; email: string; username: string },
  secret: string,
  now = Date.now()
): Promise<string> {
  const payload: SessionPayload = {
    v: 1,
    id: data.id,
    email: data.email,
    username: data.username,
    iat: now,
    exp: now + SESSION_TTL_MS,
  };
  const body = b64urlEncode(new TextEncoder().encode(JSON.stringify(payload)));
  const key = await importHmacKey(secret);
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body)));
  return `${body}.${b64urlEncode(sig)}`;
}

export async function verifySessionCookie(
  value: string | undefined | null,
  secret: string,
  now = Date.now()
): Promise<SessionPayload | null> {
  if (!value) return null;
  const dot = value.indexOf(".");
  if (dot <= 0) return null; // legacy unsigned JSON has no signature segment
  const body = value.slice(0, dot);
  const sig = value.slice(dot + 1);
  let sigBytes: Uint8Array;
  let bodyBytes: Uint8Array;
  try {
    sigBytes = b64urlDecode(sig);
    bodyBytes = b64urlDecode(body);
  } catch {
    return null;
  }
  const key = await importHmacKey(secret);
  const expected = new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body)));
  if (!constantTimeEqual(expected, sigBytes)) return null;
  let payload: SessionPayload;
  try {
    payload = JSON.parse(new TextDecoder().decode(bodyBytes)) as SessionPayload;
  } catch {
    return null;
  }
  if (payload?.v !== 1 || typeof payload.id !== "string" || !payload.id) return null;
  if (typeof payload.exp !== "number" || now >= payload.exp) return null;
  return payload;
}

export function parseCookies(header: string | null): Record<string, string> {
  const out: Record<string, string> = {};
  if (!header) return out;
  for (const part of header.split(";")) {
    const eq = part.indexOf("=");
    if (eq <= 0) continue;
    const name = part.slice(0, eq).trim();
    if (!name || name in out) continue;
    try {
      out[name] = decodeURIComponent(part.slice(eq + 1).trim());
    } catch {
      out[name] = part.slice(eq + 1).trim();
    }
  }
  return out;
}

/** Server-side session read for Route Handlers (Request has no cookies API). */
export async function getSessionFromRequest(req: Request): Promise<SessionPayload | null> {
  const secret = getSessionSecret();
  if (!secret) return null;
  const cookies = parseCookies(req.headers.get("cookie"));
  return verifySessionCookie(cookies[SESSION_COOKIE], secret);
}

export function sessionCookieHeader(signed: string, secure: boolean): string {
  const parts = [
    `${SESSION_COOKIE}=${encodeURIComponent(signed)}`,
    "Path=/",
    `Max-Age=${SESSION_TTL_MS / 1000}`,
    "SameSite=Lax",
    "HttpOnly",
  ];
  if (secure) parts.push("Secure");
  return parts.join("; ");
}

export function clearSessionCookieHeader(): string {
  return `${SESSION_COOKIE}=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax; HttpOnly`;
}
