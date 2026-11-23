/**
 * Bridge between the app's first-party HMAC session and Supabase's own
 * cookie-backed session (S5, "issue SSR cookies in parallel" route).
 *
 * The HMAC `interveai_user` cookie stays the authority for page guards and API
 * guardRequest — it is signed from a verified OAuth token and carries identity
 * only. The Supabase cookies added here carry the tokens a Server Component
 * needs to read RLS-protected rows. They are parallel, not a replacement: a
 * failure to issue or refresh them must never change the HMAC decision.
 */
import { createServerClient, serializeCookieHeader, type CookieOptions } from "@supabase/ssr";

export interface OutboundCookie {
  name: string;
  value: string;
  options: CookieOptions;
}

/**
 * @supabase/ssr defaults to httpOnly:false. These cookies carry a refresh
 * token, so leaving the default would put credential material in JS-readable
 * storage — a downgrade from the existing HttpOnly HMAC cookie. Override at
 * every construction site; `secure` follows the environment so localhost over
 * http still works while production never sends the token in clear.
 */
export const SSR_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax",
  path: "/",
} as const;

function env(): { url: string; key: string } | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  return url && key ? { url, key } : null;
}

/** The storage key @supabase/ssr derives from the project URL. */
export function ssrCookieName(): string {
  const cfg = env();
  if (!cfg) return "";
  const ref = new URL(cfg.url).hostname.split(".")[0];
  return `sb-${ref}-auth-token`;
}

/** Serialise for a Route Handler's Set-Cookie header (one call per cookie). */
export function cookieHeader(cookie: OutboundCookie): string {
  return serializeCookieHeader(cookie.name, cookie.value, cookie.options);
}

/**
 * Turn an already-verified token pair into the cookies a server client reads.
 * `setSession` only calls the network when the access token is expired; the
 * caller verifies it immediately before, so issuance is local.
 *
 * Returns an empty list when Supabase config is absent — the HMAC cookie is
 * still issued by /api/session, so an unconfigured deployment degrades to
 * exactly today's behaviour.
 */
export async function issueSsrCookies(accessToken: string, refreshToken: string): Promise<OutboundCookie[]> {
  const cfg = env();
  if (!cfg || !accessToken || !refreshToken) return [];

  const pending: OutboundCookie[] = [];
  const client = createServerClient(cfg.url, cfg.key, {
    cookieOptions: SSR_COOKIE_OPTIONS,
    cookies: {
      getAll: () => [],
      setAll: (items) => {
        for (const item of items) pending.push(item);
      },
    },
  });
  const { data, error } = await client.auth.setSession({
    access_token: accessToken,
    refresh_token: refreshToken,
  });
  if (error || !data.session) return [];
  return pending;
}

/** Expiry from the first cookie chunk; null when absent or unreadable. */
export function ssrExpiresAt(raw: string | undefined | null): number | null {
  if (!raw) return null;
  const firstChunk = raw.split(".")[0];
  if (!firstChunk) return null;
  try {
    const padded = firstChunk.replace(/-/g, "+").replace(/_/g, "/");
    const json = JSON.parse(atob(padded + "=".repeat((4 - (padded.length % 4)) % 4)));
    return typeof json?.expires_at === "number" ? json.expires_at : null;
  } catch {
    return null;
  }
}

/** Clear every chunk a session may have occupied (large sessions split into .N). */
export function clearSsrCookies(): OutboundCookie[] {
  const name = ssrCookieName();
  if (!name) return [];
  const out: OutboundCookie[] = [{ name, value: "", options: { ...SSR_COOKIE_OPTIONS, maxAge: 0 } }];
  for (let i = 0; i < 8; i++) {
    out.push({ name: `${name}.${i}`, value: "", options: { ...SSR_COOKIE_OPTIONS, maxAge: 0 } });
  }
  return out;
}

/**
 * Refresh only when the stored token is close to expiry. A healthy token costs
 * no network call; a near-expired one is exchanged through the SSR client, and
 * the resulting cookies are collected for the response rather than written in
 * a Server Component (Next disallows cookie writes there).
 */
export async function refreshSsrCookies(
  getAll: () => { name: string; value: string }[],
  thresholdSeconds = 60
): Promise<{
  cookies: OutboundCookie[];
  expired: boolean;
}> {
  const cfg = env();
  if (!cfg) return { cookies: [], expired: false };

  const items = getAll();
  const name = ssrCookieName();
  const raw = items.find((c) => c.name === name)?.value;
  if (!raw) return { cookies: [], expired: false };

  const exp = ssrExpiresAt(raw);
  if (exp === null) return { cookies: [], expired: true };
  if (exp > Date.now() / 1000 + thresholdSeconds) return { cookies: [], expired: false };

  const pending: OutboundCookie[] = [];
  const client = createServerClient(cfg.url, cfg.key, {
    cookieOptions: SSR_COOKIE_OPTIONS,
    cookies: {
      getAll: () => items,
      setAll: (next) => {
        for (const item of next) pending.push(item);
      },
    },
  });
  const { data, error } = await client.auth.getUser();
  if (error || !data.user) return { cookies: [], expired: true };
  return { cookies: pending, expired: false };
}
