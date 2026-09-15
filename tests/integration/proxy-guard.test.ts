// Phase 12: proxy gateway authorization tests (S01/S03/S04).
// The page-level gate: forged/legacy cookies must NOT pass, protected
// pages must redirect to login, public pages pass through with headers.
import { describe, it, expect } from "vitest";
import { NextRequest } from "next/server";
import { signSession } from "../../src/lib/api/session";
import { proxy } from "../../src/proxy";

process.env.SESSION_SECRET = "phase12-test-secret-0123456789abcdef";

function req(path: string, cookie?: string): NextRequest {
  const headers: Record<string, string> = {};
  if (cookie) headers.cookie = cookie;
  return new NextRequest(`http://test.local${path}`, { headers });
}

async function signedCookie(): Promise<string> {
  const signed = await signSession(
    { id: "77777777-7777-7777-8777-777777777777", email: "g@t.st", username: "g" },
    process.env.SESSION_SECRET!
  );
  return `interveai_user=${encodeURIComponent(signed)}`;
}

describe("proxy gateway", () => {
  it("redirects unauthenticated /dashboard to login", async () => {
    const res = await proxy(req("/dashboard"));
    expect([307, 308]).toContain(res.status);
    expect(res.headers.get("location")).toContain("/login");
  });

  it("rejects forged legacy JSON cookies (P0-6 regression)", async () => {
    const forged = `interveai_user=${encodeURIComponent(JSON.stringify({ id: "victim" }))}`;
    const res = await proxy(req("/dashboard", forged));
    expect([307, 308]).toContain(res.status);
    expect(res.headers.get("location")).toContain("/login");
  });

  it("rejects tampered signatures", async () => {
    const good = await signedCookie();
    const tampered = good.slice(0, -4) + "AAAA";
    const res = await proxy(req("/dashboard", tampered));
    expect([307, 308]).toContain(res.status);
  });

  it("lets valid sessions through with security headers", async () => {
    const res = await proxy(req("/dashboard", await signedCookie()));
    expect(res.status).toBe(200);
    expect(res.headers.get("content-security-policy")).toContain("default-src");
    expect(res.headers.get("x-content-type-options")).toBe("nosniff");
  });

  it("enforces interview preflight after auth", async () => {
    const cookie = await signedCookie();
    const noId = await proxy(req("/interview", cookie));
    expect(noId.headers.get("location")).toContain("/setup");
    const withId = await proxy(req("/interview?id=abc", cookie));
    expect(withId.status).toBe(200);
  });

  it("returns 401 JSON for guarded APIs without session", async () => {
    const res = await proxy(req("/api/dashboard/x"));
    expect(res.status).toBe(401);
    expect(((await res.json()) as { error: string }).error).toBe("Unauthorized");
  });

  it("leaves public pages alone", async () => {
    for (const p of ["/login", "/signup", "/", "/landing"]) {
      const res = await proxy(req(p));
      expect(res.status, p).toBe(200);
    }
  });

  it("guards all AI-consuming pages, not just dashboard", async () => {
    for (const p of ["/setup", "/chat", "/recruiter", "/practice"]) {
      const res = await proxy(req(p));
      expect([307, 308], p).toContain(res.status);
    }
  });
});

describe("route method surface (static)", () => {
  it("all API routes are POST-only (no GET/PUT/DELETE exports)", async () => {
    const { readdirSync, readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const { fileURLToPath } = await import("node:url");
    const apiDir = fileURLToPath(new URL("../../src/app/api/", import.meta.url));
    const routes = readdirSync(apiDir);
    expect(routes.length).toBeGreaterThan(0);
    // Deliberate exceptions: the session endpoint needs GET (introspect)
    // and DELETE (logout) alongside POST (issue).
    const allowed: Record<string, string[]> = { session: ["GET", "DELETE"] };
    for (const r of routes) {
      const src = readFileSync(join(apiDir, r, "route.ts"), "utf8");
      expect(src, r).toContain("export async function POST");
      for (const m of ["GET", "PUT", "DELETE", "PATCH"]) {
        if ((allowed[r] ?? []).includes(m)) continue;
        expect(src, `${r}:${m}`).not.toMatch(new RegExp(`export\\s+(async\\s+)?function\\s+${m}\\b`));
      }
    }
  });
});
