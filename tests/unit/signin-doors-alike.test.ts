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

/** Does the submit handler's `catch` say anything, or only log? */
function catchReports(rel: string, handler: string): { logs: boolean; sets: boolean } {
  const file = sf(rel);
  let logs = false;
  let sets = false;
  const visit = (node: ts.Node) => {
    const isHandler =
      (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.name.text === handler) ||
      (ts.isFunctionDeclaration(node) && node.name?.text === handler);
    if (isHandler) {
      const scan = (inner: ts.Node) => {
        if (ts.isCatchClause(inner)) {
          const text = inner.getText(file);
          logs = /console\.error\(/.test(text);
          sets = /\bset[A-Z]\w*\(/.test(text);
        }
        ts.forEachChild(inner, scan);
      };
      scan(node);
    }
    ts.forEachChild(node, visit);
  };
  visit(file);
  return { logs, sets };
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
  it("the signup submit handler's catch says so, not only to the console", () => {
    const shape = catchReports(SIGNUP, "handleSignup");
    expect(shape.logs, "no console record either — this reader missed the handler").toBe(true);
    expect(shape.sets, "the catch logs and shows nothing, so the page looks idle").toBe(true);
  });

  it("the login submit handler keeps its own message", () => {
    const shape = catchReports(LOGIN, "handleLogin");
    expect(shape.sets, "the login door regressed to silence").toBe(true);
  });
});
