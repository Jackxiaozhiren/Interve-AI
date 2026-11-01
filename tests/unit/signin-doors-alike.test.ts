// The two doors have to behave alike.
//
// /login and /signup are the same piece of product with two files, and each time
// they were allowed to differ, the difference was the bug: /signup never sent an
// already-signed-in visitor onward (so the page reachable from the footer offered
// a *new* demo identity over the account in use), and its failed submit wrote to
// the console only, which is what the provider button on the same page did until
// this week. Behaviour is held by tests/landing.spec.ts; what lives here is the
// wiring, because a browser arm cannot be planted by the falsification battery and
// a rule nobody can show failing is a rule that quietly stopped existing.
import ts from "typescript";
import { describe, expect, it } from "vitest";
import { readRepo } from "./repo-tree";

const LOGIN = "src/components/auth/LoginForm.tsx";
const SIGNUP = "src/app/signup/page.tsx";

function sf(rel: string) {
  return ts.createSourceFile(rel, readRepo(rel), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
}

/** useEffect bodies that navigate, and the identifier each one branches on. */
function redirectGates(rel: string): string[] {
  const file = sf(rel);
  const out: string[] = [];
  const visit = (node: ts.Node) => {
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === "useEffect") {
      const body = node.arguments[0];
      if (body && /router\.replace\(/.test(body.getText(file))) {
        const flag = /if\s*\(\s*(!?)(\w+)\s*\)/.exec(body.getText(file));
        out.push(`${flag?.[1] === "!" ? "!" : ""}${flag?.[2] ?? "<no condition>"}`);
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(file);
  return out;
}

/**
 * The `catch` of the door's press handler, read from the parse tree.
 *
 * Not "does the handler call onResult somewhere": the first version of this arm
 * asked that, and a plant that deleted the failure report still passed, because
 * the handler's own `onResult(null)` — the line that clears the previous message
 * before the round trip — satisfied it. The refusal is the thing to read, so the
 * catch block is the thing to read.
 */
function pressCatch(source: string): string {
  const file = ts.createSourceFile("door.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let out = "";
  const visit = (node: ts.Node) => {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.name.text === "press") {
      const scan = (inner: ts.Node) => {
        if (ts.isCatchClause(inner)) out += inner.getText(file);
        ts.forEachChild(inner, scan);
      };
      scan(node);
    }
    ts.forEachChild(node, visit);
  };
  visit(file);
  return out;
}

describe("both sign-in doors answer an already-authenticated visitor", () => {
  it("each door redirects on `isAuthenticated`", () => {
    expect(redirectGates(LOGIN), "the login door changed shape").toEqual(["isAuthenticated"]);
    expect(redirectGates(SIGNUP), "the signup door does not send a signed-in visitor in").toEqual([
      "isAuthenticated",
    ]);
  });

  it("the guard enumerates both doors rather than naming one", () => {
    // An arm written against a single file passes forever once that file is the
    // only one it reads. Both names have to appear in the corpus this file opens.
    const read = [LOGIN, SIGNUP];
    expect(read.filter((rel) => redirectGates(rel).includes("isAuthenticated"))).toEqual(read);
  });
});

describe("a refused press is reported on both doors", () => {
  // Rewritten 2026-11-01. These two arms used to read `handleSignup` and
  // `handleLogin` — the email/password submit handlers. Both handlers and their
  // forms are gone (§15.2 = a), which left the arms failing on a reader that
  // could not find its subject rather than on a defect. The rule they encoded —
  // a refusal must reach the page, not just the console — is unchanged and now
  // points at the press that still exists: the provider door, which reports
  // through `onResult` so each page keeps its own surface.
  const DOOR = "src/components/auth/oauth-buttons.tsx";

  it("the door tells the page instead of only the console", () => {
    const refusal = pressCatch(readRepo(DOOR));
    expect(refusal, `${DOOR} has no catch in its press handler to read`).not.toBe("");
    expect(refusal, "the door stopped recording the failure at all").toMatch(/console\.error/);
    expect(refusal, "the refusal never reaches the page, so the button looks like it did nothing").toMatch(
      /onResult\(/,
    );
  });

  it("both doors render the refusal where a screen reader announces it", () => {
    for (const [name, rel] of [["login", LOGIN], ["signup", SIGNUP]] as const) {
      const src = readRepo(rel);
      expect(src, `${name} does not hand the provider result to its own surface`).toMatch(
        /onResult=\{set/,
      );
      expect(src, `${name} renders no alert for a refusal`).toMatch(/role="alert"|role="status"/);
    }
  });
});
