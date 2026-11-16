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

  it("leaves /login alone — the one door an existing account has left", async () => {
    const res = await proxy(req("/login"));
    expect(res.status).toBe(200);
  });

  // 2026-11-16 (EE1/FF1, U9-a): the homepage and /landing used to be asserted
  // public here. That exact assertion was the gap — they were the last
  // anonymous surface of the pilot. Both directions are pinned: closed by
  // default in production, open only where the rendering lanes opt in.
  it("closes / and /landing by default, carrying noindex on the redirect", async () => {
    const saved = process.env.ALLOW_PUBLIC_HOME;
    delete process.env.ALLOW_PUBLIC_HOME;
    try {
      for (const p of ["/", "/landing"]) {
        const res = await proxy(req(p));
        expect([307, 308], p).toContain(res.status);
        expect(res.headers.get("location"), p).toContain("/login");
        expect(res.headers.get("location"), p).toContain(`from=${encodeURIComponent(p)}`);
        // ADJ-16: the homepage used to be "200 + noindex". After gating it
        // must stay tagged, not become an untagged 307.
        expect(res.headers.get("x-robots-tag"), p).toBe("noindex, nofollow");
      }
    } finally {
      if (saved === undefined) delete process.env.ALLOW_PUBLIC_HOME;
      else process.env.ALLOW_PUBLIC_HOME = saved;
    }
  });

  it("lets a signed-in session see / and /landing (existing accounts are kept)", async () => {
    // The first cut of the home gate returned loginRedirect() before the
    // session check, so even a valid cookie was bounced — measured on the
    // build output: the same cookie gave /dashboard 200 but / 307. The gate
    // must feed into the session path, not short-circuit it.
    const saved = process.env.ALLOW_PUBLIC_HOME;
    delete process.env.ALLOW_PUBLIC_HOME;
    try {
      const cookie = await signedCookie();
      for (const p of ["/", "/landing"]) {
        const res = await proxy(req(p, cookie));
        expect(res.status, p).toBe(200);
        expect(res.headers.get("x-robots-tag"), p).toContain("noindex");
      }
    } finally {
      if (saved === undefined) delete process.env.ALLOW_PUBLIC_HOME;
      else process.env.ALLOW_PUBLIC_HOME = saved;
    }
  });

  it("re-opens / and /landing only with ALLOW_PUBLIC_HOME=1", async () => {
    const saved = process.env.ALLOW_PUBLIC_HOME;
    process.env.ALLOW_PUBLIC_HOME = "1";
    try {
      for (const p of ["/", "/landing"]) {
        const res = await proxy(req(p));
        expect(res.status, p).toBe(200);
        expect(res.headers.get("x-robots-tag"), p).toContain("noindex");
      }
    } finally {
      if (saved === undefined) delete process.env.ALLOW_PUBLIC_HOME;
      else process.env.ALLOW_PUBLIC_HOME = saved;
    }
  });

  it("keeps the metered-AI guard list distinct from the marketing pair", async () => {
    // A future refactor that folds '/' into PROTECTED_PAGE_PREFIXES would pass
    // every behaviour assertion above but change what oauth-redirect-target
    // and recruiter-demo-contract read out of that array. Pin the separation
    // so the two contracts cannot be silently merged.
    const src = await import("node:fs").then((fs) =>
      fs.readFileSync(new URL("../../src/proxy.ts", import.meta.url), "utf8")
    );
    const list = src.slice(src.indexOf("PROTECTED_PAGE_PREFIXES"), src.indexOf("];", src.indexOf("PROTECTED_PAGE_PREFIXES")));
    expect(list).not.toMatch(/'\/'|'\/landing'/);
    expect(src).toContain("const PILOT_HOME_PAGES = ['/', '/landing']");
  });

  // 2026-11-15 (W1): /signup is closed by default for the private pilot. The
  // default is what ships to production, so the default case is the one pinned
  // first; the escape hatch is pinned second so a refactor cannot silently turn
  // it into a no-op in either direction.
  it("closes /signup by default", async () => {
    const saved = process.env.ALLOW_PUBLIC_SIGNUP;
    delete process.env.ALLOW_PUBLIC_SIGNUP;
    try {
      const res = await proxy(req("/signup"));
      expect([307, 308]).toContain(res.status);
      expect(res.headers.get("location")).toContain("/login");
    } finally {
      if (saved === undefined) delete process.env.ALLOW_PUBLIC_SIGNUP;
      else process.env.ALLOW_PUBLIC_SIGNUP = saved;
    }
  });

  it("re-opens /signup only with ALLOW_PUBLIC_SIGNUP=1", async () => {
    const saved = process.env.ALLOW_PUBLIC_SIGNUP;
    process.env.ALLOW_PUBLIC_SIGNUP = "1";
    try {
      const res = await proxy(req("/signup"));
      expect(res.status).toBe(200);
      expect(res.headers.get("x-robots-tag")).toContain("noindex");
    } finally {
      if (saved === undefined) delete process.env.ALLOW_PUBLIC_SIGNUP;
      else process.env.ALLOW_PUBLIC_SIGNUP = saved;
    }
  });

  it("sends X-Robots-Tag everywhere except robots.txt", async () => {
    const page = await proxy(req("/login"));
    expect(page.headers.get("x-robots-tag")).toBe("noindex, nofollow");
    const robotsTxt = await proxy(req("/robots.txt"));
    expect(robotsTxt.headers.get("x-robots-tag")).toBeNull();
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

  /**
   * Replaced 2026-10-04. This case asserted that a second, strict
   * `Content-Security-Policy-Report-Only` header shipped alongside the enforced
   * one. Measured against a production build that header emitted 9-12 console
   * violations per route — including one for Next.js's own inline bootstrap
   * script — so the state it was "safely" approaching cannot be reached at all
   * (57 inline `style={{}}` attributes, and nonces need a custom server this
   * deployment does not have), while its reports went to an endpoint that only
   * logs to stdout. A second header that blocks nothing and is read by nobody is
   * noise, so the decision changed rather than the threshold being lowered.
   *
   * Coverage is not reduced: the assertions below are stronger than the ones
   * removed, because they run through the real proxy() and check the policy that
   * actually bites. Why there is no longer a second header is pinned by
   * tests/unit/csp-scope.test.ts, and /api/csp-report keeps its own collector
   * tests below.
   */
  it("emits exactly one CSP header, and it is the enforced one", async () => {
    const res = await proxy(req("/dashboard", await signedCookie()));
    expect(res.headers.get("content-security-policy-report-only")).toBeNull();
    const csp = res.headers.get("content-security-policy") ?? "";
    expect(csp).toContain("default-src 'self'");
    // The tightenings that came out of the same measurement.
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("base-uri 'self'");
    expect(csp, "insecure image loads have no consumer").not.toMatch(/img-src[^;]*http:/);
    expect(csp, "the app fetches no third-party fonts").not.toContain("fonts.googleapis.com");
    expect(csp, "the app fetches no third-party font files").not.toContain("fonts.gstatic.com");
    // And the one allowance that is load-bearing for a real dependency.
    expect(csp, "Monaco is fetched from jsDelivr at runtime").toContain("https://cdn.jsdelivr.net");
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
