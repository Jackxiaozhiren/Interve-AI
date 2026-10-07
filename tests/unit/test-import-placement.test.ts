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
    /**
     * The callee's *root* name, so the qualified forms count too. Two shapes were
     * caught by the control, in sequence: matching only a property-access callee
     * (`test.skip`) reported zero for every file, and then taking the LAST name of
     * the chain reported `skip` instead of `it`, which let `it.skip(...)` hide a
     * violation. Leftmost identifier is the only reading that gets both right.
     */
    let calleeName = "";
    if (callee && ts.isIdentifier(callee)) calleeName = callee.text;
    else if (callee && ts.isPropertyAccessExpression(callee)) {
      let node: ts.Expression = callee;
      while (ts.isPropertyAccessExpression(node)) node = node.expression;
      if (ts.isIdentifier(node)) calleeName = node.text;
    }
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
  /**
   * A self-contained bad-shape source, deliberately NOT read from git.
   *
   * The first version of this control ran `git show HEAD:` on the file this
   * commit fixes, and the gate caught it: in CI, `HEAD` is the commit being
   * tested, in which the import is already hoisted, so the control asserted
   * `0 >= 3` and failed. A check that keys its own baseline to the revision under
   * test is only green before it lands. Same class of bug as the extraction
   * harness that compared `HEAD`'s page against itself an hour earlier.
   */
  const BAD_SHAPE = `
import { describe, expect, it, beforeEach } from "vitest";
const atModuleScope = await import("@/app/api/health/route");
describe("shapes", () => {
  const insideDescribeButOutsideATest = await import("@/app/api/health/route");
  beforeEach(async () => {
    const a = await import("@/app/api/health/route");
    expect(a).toBeTruthy();
  });
  it("plain identifier callee", async () => {
    const b = await import("@/app/api/parse-resume/route");
    expect(b).toBeTruthy();
  });
  it.skip("property access callee", async () => {
    const c = await import("@/app/api/parse-resume/route");
    expect(c).toBeTruthy();
  });
});
`;

  it("the walker can fail, and can tell the two positions apart", () => {
    expect(testFiles.length, "no test files found — the check would be vacuous").toBeGreaterThan(80);

    const findings = analyzeText("bad-shape.ts", BAD_SHAPE);
    // Both callee shapes are caught, and the three collection-time imports
    // (module scope and the describe body) are not.
    expect(findings.length, `found ${findings.join(", ")}`).toBe(3);
    expect(findings.some((f) => f.includes("@/app/api/parse-resume/route"))).toBe(true);

    // The shape this repo now uses must be clean, or the rule forbids its own fix.
    expect(analyzeText("parse-resume-budget.test.ts", readFileSync("tests/unit/parse-resume-budget.test.ts", "utf8"))).toEqual([]);
  });

  it("finds no app-route import inside a test body", () => {
    expect(offenders, `hoist these to module scope: ${offenders.join(", ")}`).toEqual([]);
  });
});
