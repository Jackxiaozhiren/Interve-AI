/**
 * Shared AST reads over a Playwright spec, for the guards that assert on test structure.
 *
 * `testBodies` lived inside `axe-scan-waits-for-stability.test.ts` until the
 * lane-claim guard needed the same thing — which arm exists, and what does it navigate
 * to. Two copies of a walker is how the repo already ended up with five directory walks
 * that disagreed about whether `LICENSE` is a file (see `repo-tree.ts`), so the second
 * consumer triggered the extraction rather than a third copy arriving later.
 */
import ts from "typescript";

/** Every `test("…", async (…) => { … })` in the file, keyed by its title. */
export function testBodies(sf: ts.SourceFile): Map<string, ts.Node> {
  const out = new Map<string, ts.Node>();
  const visit = (n: ts.Node) => {
    if (ts.isCallExpression(n) && ts.isIdentifier(n.expression) && n.expression.text === "test" && n.arguments.length >= 2) {
      const title = n.arguments[0];
      const body = n.arguments[1];
      if (ts.isStringLiteral(title) && body && ts.isArrowFunction(body) && body.body) out.set(title.text, body.body);
    }
    ts.forEachChild(n, visit);
  };
  visit(sf);
  return out;
}

/** The first `page.goto("<literal>")` inside a body, or null when it navigates elsewhere. */
export function firstGoto(sf: ts.SourceFile, body: ts.Node): string | null {
  let found: string | null = null;
  const visit = (n: ts.Node) => {
    if (found) return;
    if (
      ts.isCallExpression(n) &&
      ts.isPropertyAccessExpression(n.expression) &&
      n.expression.name.text === "goto" &&
      n.arguments.length >= 1 &&
      ts.isStringLiteral(n.arguments[0])
    ) {
      found = n.arguments[0].text;
      return;
    }
    ts.forEachChild(n, visit);
  };
  visit(body);
  return found;
}

/** Parse a spec the way every guard here wants it parsed. */
export function parseSpec(rel: string, text: string): ts.SourceFile {
  return ts.createSourceFile(rel, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
}
