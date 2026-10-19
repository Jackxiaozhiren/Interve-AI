// The mount-time session probe releases `isLoading`, and that is what disables
// the credential submit button on /login and /signup. An unbounded await there is
// therefore a lock on the entry door, not a delay — pinned here because the fix is
// one keyword and easy to "simplify" away.
//
// The provider buttons used to share that lock and no longer do (they need no
// session answer); tests/unit/oauth-door-clickable.test.ts owns that half. What
// stays true is the second reason for the bound: the probe is one of two routes to
// the bridge, and the other one is the auth-state listener below it.
import ts from "typescript";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const CTX_URL = new URL("../../src/context/AuthContext.tsx", import.meta.url);
const ctx = readFileSync(CTX_URL, "utf8");
const sf = ts.createSourceFile("AuthContext.tsx", ctx, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);

/**
 * The event names the `onAuthStateChange` callback branches on.
 *
 * Read off the AST rather than by searching the file: `SIGNED_IN` appears in the
 * comment above the listener as prose, and a substring test would credit that as
 * wiring.
 */
function bridgedEvents(): string[] {
  const out: string[] = [];
  const visit = (node: ts.Node) => {
    if (
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression) &&
      node.expression.name.text === "onAuthStateChange"
    ) {
      const callback = node.arguments[0];
      if (callback) {
        const collect = (inner: ts.Node) => {
          if (ts.isBinaryExpression(inner) && inner.operatorToken.kind === ts.SyntaxKind.EqualsEqualsEqualsToken) {
            for (const side of [inner.left, inner.right]) {
              if (ts.isStringLiteral(side)) out.push(side.text);
            }
          }
          ts.forEachChild(inner, collect);
        };
        collect(callback);
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return out;
}

describe("auth bootstrap cannot hang the sign-in door", () => {
  it("wraps the probe in a deadline", () => {
    // A call, not an import: `toContain("withTimeout")` is satisfied by the
    // import line alone and stayed green against a call site that dropped it.
    expect(ctx).toMatch(/withTimeout\(\s*\n?\s*supabase\.auth\.getUser\(\)/);
  });

  it("has no unbounded await left on the probe", () => {
    expect(ctx).not.toMatch(/await\s+supabase\.auth\.getUser\(\)/);
  });

  it("declares the deadline as a number, not a bare literal at the call", () => {
    const match = ctx.match(/AUTH_BOOTSTRAP_TIMEOUT_MS\s*=\s*(\d+)/);
    expect(match, "named constant").not.toBeNull();
    const ms = Number(match![1]);
    // Long enough for a slow mobile RTT token refresh, short enough that nobody
    // waits on it to press a button.
    expect(ms).toBeGreaterThanOrEqual(2000);
    expect(ms).toBeLessThanOrEqual(10_000);
  });

  it("bridges on the event a recovered session actually arrives as", () => {
    // The listener is the net for a probe that ran out its deadline, so the
    // branch it fires on has to be wiring, not prose: the sibling guard in
    // tests/unit/oauth-redirect-target.test.ts asserts `toMatch(/SIGNED_IN/)`,
    // which the comment above the listener satisfies on its own. Read off the
    // AST instead — the event names the callback compares against.
    expect(bridgedEvents(), "the listener branches on no event at all").toContain("SIGNED_IN");
  });
});
