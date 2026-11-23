/**
 * S5's first slice only adds a parallel Supabase cookie session; it must not
 * move authority away from the HMAC cookie that §15.2 hardened. These tests
 * pin both halves: the pure cookie helpers behave as claimed, and the source
 * still verifies the OAuth token before stamping anything Supabase-shaped.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  clearSsrCookies,
  cookieHeader,
  SSR_COOKIE_OPTIONS,
  ssrCookieName,
  ssrExpiresAt,
} from "@/lib/supabase/session-bridge";

const src = (rel: string) => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), "utf8");
const SESSION_ROUTE = "../../src/app/api/session/route.ts";
const PROXY = "../../src/proxy.ts";
const SERVER_CLIENT = "../../src/lib/supabase/server.ts";
const AUTH_CONTEXT = "../../src/context/AuthContext.tsx";

const savedUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const savedKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

describe("S5 parallel SSR cookie bridge", () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://abc123xyz.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-key";
  });
  afterEach(() => {
    if (savedUrl === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    else process.env.NEXT_PUBLIC_SUPABASE_URL = savedUrl;
    if (savedKey === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    else process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = savedKey;
  });

  it("names the cookie exactly as @supabase/ssr derives it from the project URL", () => {
    expect(ssrCookieName()).toBe("sb-abc123xyz-auth-token");
  });

  it("reads expiry from a base64url cookie payload, including a chunked value", () => {
    const payload = Buffer.from(JSON.stringify({ expires_at: 1900000000 })).toString("base64url");
    expect(ssrExpiresAt(payload)).toBe(1900000000);
    expect(ssrExpiresAt(`${payload}.0`)).toBe(1900000000);
    expect(ssrExpiresAt("not-json")).toBeNull();
    expect(ssrExpiresAt(undefined)).toBeNull();
  });

  it("clears the SSR session without touching the HMAC authority cookie", () => {
    const cookies = clearSsrCookies();
    expect(cookies.length).toBeGreaterThan(1);
    for (const c of cookies) {
      expect(c.name).toMatch(/^sb-abc123xyz-auth-token(\.\d+)?$/);
      expect(c.options.maxAge).toBe(0);
      expect(cookieHeader(c)).toContain(`${c.name}=`);
      expect(cookieHeader(c)).toMatch(/;\s*HttpOnly/i);
    }
    expect(cookies.map((c) => c.name)).not.toContain("interveai_user");
  });

  it("never emits a JS-readable token cookie (@supabase/ssr's default is not HttpOnly)", () => {
    expect(SSR_COOKIE_OPTIONS.httpOnly).toBe(true);
    expect(SSR_COOKIE_OPTIONS.sameSite).toBe("lax");
    // Every client construction site must carry the override; a single one
    // left at the library default would expose the refresh token to scripts.
    for (const file of [
      "../../src/lib/supabase/session-bridge.ts",
      "../../src/lib/supabase/server.ts",
    ]) {
      const text = src(file);
      const built = (text.match(/createServerClient\(/g) ?? []).length;
      const overridden = (text.match(/cookieOptions: SSR_COOKIE_OPTIONS/g) ?? []).length;
      expect(overridden, `${file}: every client needs the cookie override`).toBe(built);
    }
  });

  it("stamps SSR cookies only after the token has been verified with Supabase", () => {
    const route = src(SESSION_ROUTE);
    const verified = route.indexOf("await verifySupabaseToken(token)");
    const stamped = route.indexOf("issueSsrCookies(token, refreshToken)");
    const hmac = route.indexOf("sessionCookieHeader(signed, secure)");
    expect(verified, "the route must verify the token").toBeGreaterThan(-1);
    expect(hmac, "the HMAC cookie is still issued").toBeGreaterThan(-1);
    expect(stamped, "SSR cookies are issued").toBeGreaterThan(-1);
    expect(verified).toBeLessThan(hmac);
    expect(hmac).toBeLessThan(stamped);
    // A missing refresh token must not block the HMAC-only path.
    expect(route).toContain("if (refreshToken) {");
  });

  it("appends SSR cookies instead of replacing the HMAC Set-Cookie header", () => {
    const route = src(SESSION_ROUTE);
    expect(route).toContain('response.headers.append("Set-Cookie", cookieHeader(cookie))');
  });

  it("keeps Server Component cookie writes a no-op and delegates refresh to the proxy", () => {
    const client = src(SERVER_CLIENT);
    expect(client).toContain('setAll: () => {}');
    expect(client).toMatch(/proxy\.ts/);
    const proxy = src(PROXY);
    expect(proxy).toContain("refreshSsrCookies(() => request.cookies.getAll())");
    // Best-effort: a refresh failure cannot change a page-guard decision.
    expect(proxy).toMatch(/try \{[\s\S]*refreshSsrCookies[\s\S]*\} catch \{/);
  });

  it("sends the refresh token as transport only, never as identity", () => {
    const ctx = src(AUTH_CONTEXT);
    expect(ctx).toContain("JSON.stringify(session.refresh_token ? { refresh_token: session.refresh_token } : {})");
    const route = src(SESSION_ROUTE);
    expect(route).toContain("Transport only — never authority");
  });
});
