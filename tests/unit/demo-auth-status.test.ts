/**
 * The demo-auth hole is disclosed, bounded, and deliberately still open — this
 * keeps those three statements from drifting apart from the code.
 *
 * `POST /api/session` signs a session cookie for any well-formed identity
 * (`requireSession: false`), so "authenticated" on the 15 AI routes means "asked
 * and was given". That is known and it is not an accident: verifying an upstream
 * credential is step 2 of a two-step plan, and step 2 is blocked on a
 * test-identity decision the owner has to make, not on code. See
 * docs/SECURITY.md (`demo-auth:` line) for the rationale and the unblock
 * condition.
 *
 * Three things can silently go wrong, and each has a predicate here:
 *
 * 1. the doc claims a state the route does not have (or vice versa) — so the
 *    state is *derived from the route's parse tree* and compared to the doc;
 * 2. the browser suite starts depending on the hole again, which would make the
 *    hole load-bearing and uncloseable. Step 1 signed sessions directly instead
 *    of POSTing to the endpoint; that is pinned here, not trusted;
 * 3. step 2 lands and nobody rewrites the UI copy that currently says the demo
 *    path does not save data. Once identity is verified that sentence is false —
 *    modesty that outlives its reason is still a false claim — so the verified
 *    branch requires the disclosure to be gone.
 */
import { readFileSync } from "node:fs";
import ts from "typescript";
import { describe, expect, it } from "vitest";

const ROUTE = "src/app/api/session/route.ts";
const DOC = "docs/SECURITY.md";
const HELPERS = "tests/helpers.ts";

const read = (rel: string) => readFileSync(new URL(`../../${rel}`, import.meta.url), "utf8");

/**
 * Names that would mean "the server checked a credential with an upstream".
 * Deliberately a closed list: when the real cutover happens it will come through
 * one of these, and if it arrives through a new name this test goes red before
 * the doc can quietly become wrong.
 */
const VERIFICATION_SURFACE = [
  "getUser",
  "verifyIdToken",
  "verifyToken",
  "signInWithIdToken",
  "verifyGoogleCredential",
  "auth.getUser",
];

function routeState(): { verified: boolean; evidence: string[] } {
  const src = read(ROUTE);
  const sf = ts.createSourceFile(ROUTE, src, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const hits: string[] = [];
  const visit = (node: ts.Node) => {
    const text = ts.isIdentifier(node) || ts.isPropertyAccessExpression(node) ? node.getText(sf) : "";
    if (text && VERIFICATION_SURFACE.includes(text)) hits.push(text);
    if (
      ts.isPropertyAssignment(node) &&
      ts.isIdentifier(node.name) &&
      node.name.text === "requireSession" &&
      node.initializer.kind === ts.SyntaxKind.TrueKeyword
    ) {
      hits.push("requireSession: true");
    }
    node.forEachChild(visit);
  };
  visit(sf);
  return { verified: hits.length > 0, evidence: hits };
}

function documentedState(): "unverified-mint" | "server-verified" | null {
  const m = /demo-auth:\s*`?(unverified-mint|server-verified)`?/.exec(read(DOC));
  return m ? (m[1] as "unverified-mint" | "server-verified") : null;
}

const state = routeState();

describe("demo-auth status stays disclosed, bounded, and consistent", () => {
  it("derives a state from the route at all (instrument sanity)", () => {
    // A walker that finds neither verification calls nor requireSession would
    // report "unverified" for every repo, passing by construction.
    expect(state).toHaveProperty("verified");
    expect(Array.isArray(state.evidence)).toBe(true);
    const guard = read(ROUTE);
    expect(guard).toMatch(/requireSession:\s*(true|false)/);
  });

  it("states that derived state in docs/SECURITY.md", () => {
    expect(documentedState(), `${DOC} carries no demo-auth: status`).not.toBeNull();
    const expected = state.verified ? "server-verified" : "unverified-mint";
    expect(
      documentedState(),
      state.verified
        ? `route verifies (${state.evidence.join(", ")}) but the doc says otherwise`
        : "route still mints without verifying, and the doc must say so"
    ).toBe(expected);
  });

  if (state.verified) {
    it("drops the demo disclosure once identity is actually verified", () => {
      const loginForm = read("src/components/auth/LoginForm.tsx");
      const signup = read("src/app/signup/page.tsx");
      expect(loginForm).not.toMatch(/或用演示账号\(不保存数据\)/);
      expect(signup).not.toMatch(/或用演示账号\(不保存数据\)/);
    });

    it("moves the browser suite off the direct-signing shortcut", () => {
      expect(read(HELPERS)).not.toMatch(/\bsignSession\s*\(/);
    });
  } else {
    it("keeps the browser suite off the unverified mint", () => {
      // Step 1: loginAs() signs the cookie with the server's own signSession()
      // rather than POSTing an arbitrary identity, so the hole is not load-bearing
      // for the suite and can be closed without breaking 11 spec files.
      const helpers = read(HELPERS);
      expect(helpers, "loginAs() must not depend on the unverified endpoint").not.toMatch(
        /["'`]\/api\/session/
      );
      expect(helpers).toMatch(/signSession\s*\(/);
    });

    it("keeps the route's own comment honest about what it does", () => {
      expect(read(ROUTE)).toMatch(/[Dd]emo auth/);
    });
  }
});
