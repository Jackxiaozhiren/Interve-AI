// Where a sign-in redirect is allowed to send somebody.
//
// `src/proxy.ts` puts the page an unauthenticated visitor wanted into
// `?from=`, and LoginForm reads it back after sign-in. Reading it is the whole
// attack surface: a link that looks like this app —
//
//     https://<host>/login?from=https://evil.example
//
// completed the flow and then handed the visitor, with a fresh session, to
// another origin. Measured against the running app before this file existed, an
// authenticated visit with that `from` landed on `chrome-error://chromewebdata/`
// — the browser had left the site. A protocol-relative `//evil.example/x` was
// worse in a plainer way: nothing navigated at all, so a signed-in visitor sat on
// the door that is supposed to send them in.
//
// Rules, as predicates:
//   R1  a path on this origin comes back as the path the router should use;
//   R2  every shape that would leave this origin falls back instead;
//   R3  `..` is normalised rather than rejected, so traversal cannot survive into
//       the navigation but an odd-looking internal path is not lost;
//   R4  the shipped consumer calls it, inside the effect that navigates — a helper
//       nobody uses polices nothing (that is how the Orama index shipped with a
//       promise and no writer);
//   R5  the sentinel used for resolution never leaks into the result.
import ts from "typescript";
import { describe, expect, it } from "vitest";
import { safeInternalPath } from "../../src/utils/redirect";
import { readRepo, walkRepo } from "./repo-tree";

const FALLBACK = "/dashboard";

describe("a sign-in redirect stays on this origin", () => {
  it("R1: keeps a path that belongs to the app", () => {
    for (const path of ["/dashboard", "/dashboard?ok=1", "/practice/q1?x=1", "/"]) {
      expect(safeInternalPath(path, FALLBACK), path).toBe(path);
    }
  });

  it("R2: falls back for every shape that leaves the origin", () => {
    // Not a list of prefixes: `//host` is protocol-relative, `/\host` is what URL
    // parsing turns backslashes into, `javascript:` has no origin at all, and a
    // bare `host` resolves relative to the current path. A check for
    // `startsWith("//")` alone misses three of these four.
    for (const hostile of [
      "//evil.example/x",
      "https://evil.example/y",
      "http://evil.example",
      "/\\evil.example",
      "\\\\evil.example",
      "javascript:alert(1)",
      "data:text/html,hi",
      "evil.example/path",
      "",
      null,
    ]) {
      expect(safeInternalPath(hostile, FALLBACK), String(hostile)).toBe(FALLBACK);
    }
  });

  it("R3: normalises traversal instead of rejecting the path", () => {
    expect(safeInternalPath("/a/../b", FALLBACK)).toBe("/b");
    // A path that climbs out of the app's own tree is not a page; `/../../etc`
    // normalises to a path on this origin, which is the safe reading.
    expect(safeInternalPath("/../../etc/passwd", FALLBACK)).toBe("/etc/passwd");
  });

  it("R5: the sentinel origin never appears in what the router is handed", () => {
    for (const path of ["/dashboard", "/a/../b", "/practice/q1?x=1"]) {
      const result = safeInternalPath(path, FALLBACK);
      expect(result, result).toMatch(/^\//);
      expect(result, result).not.toMatch(/self\.invalid|https?:\/\//);
    }
  });
});

describe("the shipped door uses the decision", () => {
  const CONSUMER = "src/components/auth/LoginForm.tsx";

  it("R4: a component calls it, so the rule runs in the product", () => {
    const callers = new Set<string>();
    for (const rel of walkRepo("src", (p) => /\.(ts|tsx)$/.test(p))) {
      const text = readRepo(rel);
      if (!text.includes("safeInternalPath")) continue;
      const sf = ts.createSourceFile(rel, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
      const visit = (node: ts.Node) => {
        if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === "safeInternalPath") {
          // the definition's own export is not a caller
          const isOwnDefinition =
            ts.isFunctionDeclaration(node.parent) && node.parent.name?.text === "safeInternalPath";
          if (!isOwnDefinition && !rel.endsWith("src/utils/redirect.ts")) callers.add(rel);
        }
        ts.forEachChild(node, visit);
      };
      visit(sf);
    }
    expect([...callers], "nothing calls safeInternalPath, so ?from= is used raw").toEqual([CONSUMER]);
  });

  it("R4: the call sits in the effect that performs the navigation", () => {
    // Not merely "somewhere in the file": outside the redirect effect the decision
    // would guard a navigation that no longer exists.
    const sf = ts.createSourceFile(CONSUMER, readRepo(CONSUMER), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    const effectWithNavigation = (node: ts.Node): boolean => {
      if (!(ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === "useEffect")) {
        return false;
      }
      const body = node.arguments[0]?.getText(sf) ?? "";
      return /router\.replace\(/.test(body) && body.includes("safeInternalPath");
    };
    let found = false;
    const visit = (node: ts.Node) => {
      if (effectWithNavigation(node)) found = true;
      ts.forEachChild(node, visit);
    };
    visit(sf);
    expect(found, "the redirect effect does not consult safeInternalPath").toBe(true);
  });

  it("R4: the fallback is a page the guard protects, not a bare root", () => {
    const consumer = readRepo(CONSUMER);
    expect(consumer, "the redirect must fall back to a route the app owns").toMatch(/ROUTES\.DASHBOARD/);
  });
});
