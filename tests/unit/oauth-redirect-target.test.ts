// OAuth cannot complete today, and the reason is a cross-file coupling nothing
// checked. supabase-js defaults to PKCE, so the provider returns to
// `redirectTo` with ?code=&state= in the QUERY. src/proxy.ts guards
// /dashboard with the app's HMAC cookie, and a first-time signer has none, so
// the server answers:
//     307 -> /login?from=%2Fdashboard      (measured against a running dev
//                                           server; code and state dropped)
// The authorization code is gone before any client JS runs, so
// AuthContext's Supabase bridge (src/context/AuthContext.tsx:51-74, which does
// exist and is correct) never finds a session to bridge.
//
// The invariant: the OAuth redirect target must not be a proxy-protected page.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

const AUTH = new URL("../../src/lib/auth.ts", import.meta.url);
const PROXY = new URL("../../src/proxy.ts", import.meta.url);

// Owned by src/proxy.ts (PROTECTED_PAGE_PREFIXES). Re-listed here rather than
// imported because proxy.ts is an edge module; if the two drift, the next
// assertion is the one that fails, which is the point.
const PROTECTED = ["/dashboard", "/setup", "/interview", "/chat", "/recruiter", "/practice"];

const src = () => readFileSync(AUTH, "utf8");

describe("OAuth redirect target vs the page guard", () => {
  it("lands outside every proxy-protected prefix", () => {
    const m = src().match(/redirectTo:[^`]*`\$\{window\.location\.origin\}(\/[^`?]*)`/);
    expect(m, "could not find the redirectTo literal in src/lib/auth.ts").toBeTruthy();
    const target = m![1];
    const guarded = PROTECTED.filter(
      (p) => target === p || target.startsWith(`${p}/`)
    );
    expect(guarded, `redirectTo ${target} is guarded by proxy.ts (${guarded}) and 307s away the PKCE code`).toEqual([]);
  });

  it("lands somewhere that actually reads the session and forwards on", () => {
    // Bouncing to a page that ignores the session would pass the assertion
    // above and still leave sign-in broken.
    const m = src().match(/redirectTo:[^`]*`\$\{window\.location\.origin\}(\/[^`?]*)`/);
    // The non-null check is the point: `m![1]` below was only ever a throw
    // guard, so say it out loud and drop the unused binding.
    expect(m, "the OAuth redirect target is no longer an origin-relative path").not.toBeNull();
    const loginForm = readFileSync(
      new URL("../../src/components/auth/LoginForm.tsx", import.meta.url),
      "utf8"
    );
    const context = readFileSync(
      new URL("../../src/context/AuthContext.tsx", import.meta.url),
      "utf8"
    );
    // The landing page's component must be mounted there...
    expect(loginForm).toContain("useAuth");
    // ...and the bridge that converts a Supabase user into an app cookie must
    // still be wired.
    expect(context).toContain("supabase.auth.getUser");
  });

  it("keeps the guard list honest", () => {
    const proxy = readFileSync(PROXY, "utf8");
    for (const p of PROTECTED) {
      expect(proxy, `${p} no longer guarded? update this list`).toContain(`'${p}'`);
    }
  });

  // Code-derived, not reproduced against a live IdP (a real round trip would
  // create a production user row): supabase-js finishes the PKCE exchange in an
  // async init, while AuthContext's bridge calls getUser() once at mount. If the
  // exchange lands after that call, getUser() has no token yet, returns null, and
  // the candidate sits on the landing page with a valid Supabase session and no
  // app cookie. The subscription is what removes the timing dependency.
  it("bridges on the auth state change, not only on mount", () => {
    const context = readFileSync(
      new URL("../../src/context/AuthContext.tsx", import.meta.url),
      "utf8"
    );
    expect(context).toContain("onAuthStateChange");
    expect(context).toMatch(/SIGNED_IN/);
  });
});
