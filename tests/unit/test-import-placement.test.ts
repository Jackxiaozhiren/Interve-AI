/**
 * A test file's own imports belong at module scope, not inside a test body.
 *
 * `parse-resume-budget.test.ts` asserted the route's `runtime` and `maxDuration`
 * by awaiting the route's import *inside* the two `it()` bodies. The route pulls
 * `pdf-parse`, and a cold load of that graph costs 7-9s on this machine — more
 * than vitest's 5s default `testTimeout`. So the guard reported failure on a
 * property that had not changed: run alone on unmodified main it failed with
 * "Test timed out in 5000ms" at 7023ms, and in full-suite runs the victim moved
 * between files depending on who was competing for CPU. The fix was to hoist the
 * import, which pays the cost during collection — where no per-test budget
 * applies — rather than raising the timeout or skipping the assertion.
 *
 * Measured before reaching for a rule: exactly one file in `tests/` imports an
 * app route inside a test body, and it is the one being fixed. So this is a
 * ceiling of zero to keep it from coming back, not a debt tracker.
 */
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import ts from "typescript";
import { describe, expect, it } from "vitest";

/** What the call site looks like, and what the specifier must be. */
const ROUTE_CALL = /import\(\s*["']@\/app\/api\//;
const ROUTE_SPECIFIER = /^@\/app\/api\//;

function analyzeText(file: string, text: string): string[] {
  // Cheap pre-filter: a file that never mentions a route import cannot contribute.
  if (!ROUTE_CALL.test(text)) return [];
  const sf = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const found: string[] = [];

  let insideTest = 0;
  const visit = (node: ts.Node) => {
    const isCall = ts.isCallExpression(node);
    const callee = isCall ? node.expression : null;
    // `it(...)` is an Identifier callee and `test.skip(...)` is a property access;
    // matching only the latter made the walker report zero for every file, which
    // the control against the pre-fix source is what caught.
    const calleeName =
      callee && ts.isIdentifier(callee) ? callee.text
      : callee && ts.isPropertyAccessExpression(callee) ? callee.name.text
      : "";
    // `describe` is deliberately absent: its callback runs at collection, so an
    // import there is the position this rule asks for, not a violation.
    const entersTest = isCall && ["it", "test", "beforeEach", "afterEach"].includes(calleeName);
    if (entersTest) insideTest += 1;

    if (ts.isCallExpression(node) && node.expression.getText(sf) === "import" && node.arguments.length) {
      const arg = node.arguments[0];
      if (ts.isStringLiteral(arg) && ROUTE_SPECIFIER.test(arg.text) && insideTest > 0) {
        found.push(`${file}: ${arg.text}`);
      }
    }
    node.forEachChild(visit);
    if (entersTest) insideTest -= 1;
  };
  visit(sf);
  return found;
}

const routeImportsInsideTestBodies = (file: string) => analyzeText(file, readFileSync(file, "utf8"));

const testFiles = execFileSync("git", ["ls-files", "tests"], { encoding: "utf8" })
  .split("\n")
  .filter((f) => /\.(ts|tsx)$/.test(f));

const offenders = testFiles.flatMap(routeImportsInsideTestBodies);

describe("heavy imports sit at module scope in test files", () => {
  it("the walker can fail, against the shape it was written for", () => {
    expect(testFiles.length, "no test files found — the check would be vacuous").toBeGreaterThan(80);

    // The control is the real pre-fix file, not a hand-written string: this
    // commit's parent still has the route imported inside three `it()` bodies,
    // so if the walker cannot see those it cannot see a regression either.
    const before = execFileSync("git", ["show", "HEAD:tests/unit/parse-resume-budget.test.ts"], { encoding: "utf8" });
    expect(analyzeText("parse-resume-budget.test.ts(prev)", before).length).toBeGreaterThanOrEqual(3);

    // And the module-scope position this fix moves them to must be clean,
    // otherwise the rule would forbid the very thing it asks for.
    expect(analyzeText("parse-resume-budget.test.ts(now)", readFileSync("tests/unit/parse-resume-budget.test.ts", "utf8"))).toEqual([]);
  });

  it("finds no app-route import inside a test body", () => {
    expect(offenders, `hoist these to module scope: ${offenders.join(", ")}`).toEqual([]);
  });
});
