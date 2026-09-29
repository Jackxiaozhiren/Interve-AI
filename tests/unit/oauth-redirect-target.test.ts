// The invariant this file owns: the OAuth redirect target must not be a page
// behind the auth guard.
//
// CORRECTION, measured 2026-09-29, because the original reasoning here was
// wrong and a wrong reason in a test header is how the next reader makes a
// worse decision. What I claimed when writing this: "supabase-js defaults to
// PKCE, so the provider returns ?code=&state= in the QUERY, and the guard's
// 307 drops them." Two measurements say otherwise:
//
//   1. The live handoff carries no code_challenge at all — src/lib/supabase.ts
//      is createClient(url, key) with no options, so flowType is the default
//      'implicit' and gotrue returns the session in the URL FRAGMENT.
//      (Observed: clicking Google on production lands on accounts.google.com
//      with redirect_uri=<project>.supabase.co/auth/v1/callback,
//      response_type=code, state set, code_challenge absent.)
//   2. Against a running dev server: a fragment SURVIVES the guard's 307
//      (/dashboard#access_token=… -> /login?from=%2Fdashboard#access_token=…),
//      while query params do NOT (/setup?code=X&state=Y -> /login?from=%2Fsetup,
//      X gone). My earlier "measured: code and state dropped" was real about
//      query strings and irrelevant to the flow actually in use, because the
//      real flow never sends one.
//
// So redirectTo=/dashboard would not have destroyed the callback, and the thing
// that actually blocked sign-in is the other half of the same commit: nothing
// converted the Supabase session into the app's own cookie at the moment the
// fragment was consumed. That is what onAuthStateChange('SIGNED_IN') below
// fixes, and it is the assertion that matters most in this file.
//
// The target invariant is still worth holding, for hop reasons rather than
// data-loss reasons: landing on a guarded path means an extra 307, a ?from=
// that predates the session, and a dependence on browsers re-applying a
// fragment across a redirect — true today in Chromium, and not something this
// app should be relying on for sign-in.
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
    expect(guarded, `redirectTo ${target} is behind proxy.ts's guard (${guarded}) — sign-in would take an extra 307 and depend on fragment propagation`).toEqual([]);
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
    // ...it must move an already-authenticated visitor onward, which is what
    // makes /login a safe target rather than a dead end after sign-in...
    expect(loginForm).toContain("isAuthenticated");
    expect(loginForm).toMatch(/router\.replace\(/);
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
  // create a production user row): supabase-js finishes consuming the callback
  // in an async init, while AuthContext's bridge calls getUser() once at mount.
  // If the exchange lands after that call, getUser() has no token yet, returns
  // null, and the candidate sits on the landing page with a valid Supabase
  // session and no app cookie. The subscription is what removes the timing
  // dependency.
  it("bridges on the auth state change, not only on mount", () => {
    const context = readFileSync(
      new URL("../../src/context/AuthContext.tsx", import.meta.url),
      "utf8"
    );
    expect(context).toContain("onAuthStateChange");
    expect(context).toMatch(/SIGNED_IN/);
  });
});
