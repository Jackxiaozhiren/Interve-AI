// Phase 12: proxy gateway authorization tests (S01/S03/S04).
// The page-level gate: forged/legacy cookies must NOT pass, protected
// pages must redirect to login, public pages pass through with headers.
import { describe, it, expect } from "vitest";
import { NextRequest } from "next/server";
import { signSession } from "../../src/lib/api/session";
import { proxy } from "../../src/proxy";

process.env.SESSION_SECRET = "phase12-test-secret-0123456789abcdef";

function req(path: string, cookie?: string, extraHeaders: Record<string, string> = {}): NextRequest {
  const headers: Record<string, string> = { ...extraHeaders };
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

  it("CVE-2025-29927: x-middleware-subrequest does not bypass the gate", async () => {
    // Our proxy() never trusts this header; pin it so framework upgrades
    // cannot silently reintroduce the middleware-bypass class.
    const forged = { "x-middleware-subrequest": "middleware:middleware:middleware:middleware" };
    const page = await proxy(req("/dashboard", undefined, forged));
    expect([307, 308]).toContain(page.status);
    expect(page.headers.get("location")).toContain("/login");
    const api = await proxy(req("/api/dashboard/x", undefined, forged));
    expect(api.status).toBe(401);
    // Legit traffic carrying the header still passes with a valid session.
    const legit = await proxy(req("/dashboard", await signedCookie(), forged));
    expect(legit.status).toBe(200);
  });

  it("emits report-only strict CSP alongside the enforcing header (Phase B5)", async () => {
    const res = await proxy(req("/dashboard", await signedCookie()));
    const ro = res.headers.get("content-security-policy-report-only") ?? "";
    expect(ro).toContain("default-src 'self'");
    expect(ro).toContain("report-uri /api/csp-report");
    expect(ro, "report-only must not allow unsafe-inline").not.toContain("unsafe-inline");
    expect(ro, "report-only must not allow unsafe-eval").not.toContain("unsafe-eval");
  });
});

describe("csp-report collector (Phase B5)", () => {
  it("always 204 with empty body: valid, garbage, and oversize payloads", async () => {
    const { POST } = await import("../../src/app/api/csp-report/route");
    const post = (body: string, ip: string) =>
      POST(
        new Request("http://test.local/api/csp-report", {
          method: "POST",
          headers: { "content-type": "application/json", "x-forwarded-for": ip },
          body,
        })
      );
    const valid = await post(
      JSON.stringify({ "csp-report": { "violated-directive": "script-src", "blocked-uri": "https://evil.example/x.js" } }),
      "10.200.0.1"
    );
    expect(valid.status).toBe(204);
    expect(await valid.text()).toBe("");
    expect(valid.headers.get("x-request-id")).toBeTruthy();
    const garbage = await post("not json", "10.200.0.2");
    expect(garbage.status).toBe(204);
    const big = await post(JSON.stringify({ "csp-report": { "blocked-uri": "x".repeat(9000) } }), "10.200.0.3");
    expect(big.status).toBe(204);
  });
});

describe("health probe (H2.4)", () => {
  it("GET always 200 with ok/degraded body (DB-down never 500s)", async () => {
    const { GET } = await import("../../src/app/api/health/route");
    const res = await GET(
      new Request("http://test.local/api/health", { headers: { "x-forwarded-for": "10.201.0.1" } })
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { status: string; checks: { db: string; dbLatencyMs: number } };
    expect(["ok", "degraded"]).toContain(body.status);
    expect(["ok", "degraded"]).toContain(body.checks.db);
    expect(typeof body.checks.dbLatencyMs).toBe("number");
    expect(res.headers.get("x-request-id")).toBeTruthy();
  }, 15000);
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
    // and DELETE (logout) alongside POST (issue); H2.4 health is GET-only
    // (load balancers / CI / Docker smoke poll via GET, cannot POST auth).
    const allowed: Record<string, string[]> = { session: ["GET", "DELETE"], health: ["GET"] };
    const postOptional = new Set(["health"]);
    for (const r of routes) {
      const src = readFileSync(join(apiDir, r, "route.ts"), "utf8");
      if (!postOptional.has(r)) expect(src, r).toContain("export async function POST");
      for (const m of ["GET", "PUT", "DELETE", "PATCH"]) {
        if ((allowed[r] ?? []).includes(m)) continue;
        expect(src, `${r}:${m}`).not.toMatch(new RegExp(`export\\s+(async\\s+)?function\\s+${m}\\b`));
      }
    }
  });
});
