/**
 * A route's request guard and its function duration budget are two numbers in two
 * places that have to agree, and nothing checked it until parse-resume surfaced
 * the cost: the guard was prepared to wait, the platform was not, and the user got
 * a body that was not JSON.
 *
 * The rule is repo-static and needs no platform knowledge: if the guard says it
 * will wait `N` ms, the function must declare a `maxDuration` that outlasts that
 * wait *with room to answer*. Room matters because the two bounds are not equal
 * instruments — a lane abort runs the route's own catch, logs a reason and writes
 * a JSON error, while the platform kill simply stops the invocation. A guard that
 * gives up at the same instant the runtime does is a guard that never fires.
 *
 * Both numbers are read off the parse tree, because the first version of this file
 * read them with `src.match(/timeoutMs:\s*([0-9_]+)/)`. That extraction had three
 * holes, all measured rather than theorised:
 *   - `analyze-practice` passes `timeoutMs: PRACTICE_TIMEOUT_MS`, so the lane whose
 *     45s budget carries the most careful reasoning in the repo was invisible to
 *     the rule written to check it. Raising that constant above its 60s function
 *     budget would not have reddened anything.
 *   - A sentence in a comment that spelled `timeoutMs: 999999` was read as the
 *     route's value, and only the first match in the file counted.
 *   - `parse-resume` hand-rolls its pipeline and passes its budget to
 *     `combineSignal` directly, so it appeared to have no timeout at all.
 *
 * Routes whose lane timeout is the shared default are reported against that
 * default as measured from `guard.ts`, not as remembered here.
 */
import ts from "typescript";
import { describe, expect, it } from "vitest";
import { readRepo, walkRepo } from "./repo-tree";

/** Milliseconds a lane must leave itself before the platform kill to write its answer. */
const MIN_MARGIN_MS = 5_000;

interface Budget {
  route: string;
  /** The lane timeout the route declares, or null when it inherits the default. */
  timeoutMs: number | null;
  /** How that number was found: `guardRequest`, `combineSignal`, or neither. */
  via: "guardRequest" | "combineSignal" | null;
  maxDuration: number | null;
}

function parse(fileName: string, sourceText: string): ts.SourceFile {
  return ts.createSourceFile(fileName, sourceText, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
}

/** `45_000` or `PRACTICE_TIMEOUT_MS` resolved against a same-file numeric const. */
function numericValue(node: ts.Node | undefined, sourceFile: ts.SourceFile): number | null {
  if (!node) return null;
  if (ts.isNumericLiteral(node)) return Number(node.text);
  if (ts.isIdentifier(node)) {
    let value: number | null = null;
    const find = (n: ts.Node) => {
      if (value !== null) return;
      if (ts.isVariableDeclaration(n) && ts.isIdentifier(n.name) && n.name.text === node.text && n.initializer) {
        const init = n.initializer;
        if (ts.isNumericLiteral(init)) value = Number(init.text);
      }
      ts.forEachChild(n, find);
    };
    find(sourceFile);
    return value;
  }
  return null;
}

/** The options object of the first `guardRequest(req, { … })` call, if any. */
function guardOptions(sourceFile: ts.SourceFile): ts.ObjectLiteralExpression | null {
  let found: ts.ObjectLiteralExpression | null = null;
  const visit = (node: ts.Node) => {
    if (found) return;
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === "guardRequest") {
      const arg = node.arguments[1];
      if (arg && ts.isObjectLiteralExpression(arg)) found = arg;
    }
    ts.forEachChild(node, visit);
  };
  ts.forEachChild(sourceFile, visit);
  return found;
}

function propertyValue(options: ts.ObjectLiteralExpression, name: string): ts.Node | undefined {
  for (const p of options.properties) {
    if (ts.isPropertyAssignment(p) && ts.isIdentifier(p.name) && p.name.text === name) return p.initializer;
  }
  return undefined;
}

/** A route's own lane budget: the guard option, or what it hands `combineSignal`. */
function readLaneTimeout(sourceText: string, fileName: string): { ms: number | null; via: Budget["via"] } {
  const sourceFile = parse(fileName, sourceText);
  const options = guardOptions(sourceFile);
  if (options) {
    const declared = propertyValue(options, "timeoutMs");
    if (declared) return { ms: numericValue(declared, sourceFile), via: "guardRequest" };
  }
  let combined: number | null = null;
  let viaCombine = false;
  const visit = (node: ts.Node) => {
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === "combineSignal") {
      viaCombine = true;
      if (combined === null) combined = numericValue(node.arguments[1], sourceFile);
    }
    ts.forEachChild(node, visit);
  };
  ts.forEachChild(sourceFile, visit);
  return viaCombine ? { ms: combined, via: "combineSignal" } : { ms: null, via: null };
}

/** `export const maxDuration = N` in seconds, as the platform reads it. */
function readMaxDuration(sourceText: string, fileName: string): number | null {
  const sourceFile = parse(fileName, sourceText);
  let value: number | null = null;
  const visit = (node: ts.Node) => {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.name.text === "maxDuration" && node.initializer) {
      if (ts.isNumericLiteral(node.initializer)) value = Number(node.initializer.text);
    }
    ts.forEachChild(node, visit);
  };
  ts.forEachChild(sourceFile, visit);
  return value;
}

/**
 * The default `guardRequest` applies when a route declares no `timeoutMs`, read
 * from the `?? ` fallback in its own `combineSignal` call. Measured rather than
 * remembered: the number this file assumed used to be a literal in a comment here.
 */
function readGuardDefaultTimeout(guardSourceText: string): number | null {
  const sourceFile = parse("guard.ts", guardSourceText);
  let value: number | null = null;
  const visit = (node: ts.Node) => {
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === "combineSignal") {
      const arg = node.arguments[1];
      if (arg && ts.isBinaryExpression(arg) && arg.operatorToken.kind === ts.SyntaxKind.QuestionQuestionToken) {
        value = numericValue(arg.right, sourceFile);
      }
    }
    ts.forEachChild(node, visit);
  };
  ts.forEachChild(sourceFile, visit);
  return value;
}

/**
 * The whole rule as one pure function of the two numbers, so the shapes that must
 * fail can be shown without editing a route to break it.
 */
function budgetViolation(timeoutMs: number, maxDuration: number | null): string | null {
  if (maxDuration === null) return "declares a lane timeout and no maxDuration";
  const platformMs = maxDuration * 1000;
  if (timeoutMs + MIN_MARGIN_MS > platformMs) {
    return `waits ${timeoutMs}ms against a ${maxDuration}s function (${platformMs - timeoutMs}ms of headroom, needs ${MIN_MARGIN_MS})`;
  }
  return null;
}

const routeFiles = () => walkRepo("src/app/api", (rel) => rel.endsWith("route.ts"));

function readBudgets(): Budget[] {
  return routeFiles().map((file) => {
    const src = readRepo(file);
    const lane = readLaneTimeout(src, file);
    return { route: file, timeoutMs: lane.ms, via: lane.via, maxDuration: readMaxDuration(src, file) };
  });
}

const budgets = readBudgets();
const guardDefault = readGuardDefaultTimeout(readRepo("src/lib/api/guard.ts"));

describe("route guard timeout vs function duration budget", () => {
  it("the probe reads real routes, not an empty directory", () => {
    // Without this, a broken path or regex would make every assertion below
    // pass by finding nothing.
    expect(budgets.length, "no API routes parsed").toBeGreaterThanOrEqual(15);
    const declared = budgets.filter((b) => b.timeoutMs !== null);
    expect(declared.length, "no route resolved a lane timeout — the extraction, not the code, changed")
      .toBeGreaterThanOrEqual(12);
    expect(declared.filter((b) => b.via === "guardRequest").length).toBeGreaterThanOrEqual(11);
    expect(declared.filter((b) => b.via === "combineSignal").length, "the hand-rolled lane is invisible again")
      .toBeGreaterThanOrEqual(1);
    expect(budgets.filter((b) => b.maxDuration !== null).length).toBeGreaterThanOrEqual(9);
    expect(guardDefault, "the shared default could not be read off guard.ts").toBeTypeOf("number");
  });

  it("every guard that waits leaves the platform room to be answered", () => {
    const violations = budgets
      .filter((b) => b.timeoutMs !== null)
      .map((b) => ({ b, problem: budgetViolation(b.timeoutMs as number, b.maxDuration) }))
      .filter((v) => v.problem !== null)
      .map((v) => `${v.b.route} (${v.b.via}) ${v.problem}`);
    expect(violations, `guards outliving their functions:\n  ${violations.join("\n  ")}`).toEqual([]);
  });

  it("no budget is padded absurdly beyond what the guard will wait", () => {
    // The other direction: a 170s function whose guard gives up after 5s is
    // paying for headroom nothing uses, and it hides a guard that was never
    // meant to be that short.
    const odd = budgets
      .filter((b) => b.timeoutMs !== null && b.maxDuration !== null)
      .filter((b) => b.maxDuration! * 1000 > b.timeoutMs! * 4)
      .map((b) => `${b.route} budget=${b.maxDuration}s guard=${b.timeoutMs}ms`);
    expect(odd, `budget far beyond the guard:\n  ${odd.join("\n  ")}`).toEqual([]);
  });

  it("resolves the number the route actually passes", () => {
    // The three shapes the old text scan got wrong, driven through the shipped
    // extractor: a named constant, a sentence, and a hand-rolled budget.
    expect(
      readLaneTimeout(
        `export const LANE_TIMEOUT_MS = 45_000;\nconst g = await guardRequest(req, { route: "x", timeoutMs: LANE_TIMEOUT_MS });`,
        "fixture.ts"
      )
    ).toEqual({ ms: 45000, via: "guardRequest" });
    expect(
      readLaneTimeout(
        `// a comment that spells timeoutMs: 999999 and means nothing\nconst g = await guardRequest(req, { route: "x" });`,
        "fixture.ts"
      )
    ).toEqual({ ms: null, via: null });
    expect(
      readLaneTimeout(
        `const LANE = 90_000;\nexport async function POST(req) { const signal = combineSignal(req, LANE); }`,
        "fixture.ts"
      )
    ).toEqual({ ms: 90000, via: "combineSignal" });
    expect(readMaxDuration(`export const maxDuration = 60;\n`, "fixture.ts")).toBe(60);
    expect(readMaxDuration(`// export const maxDuration = 900;\n`, "fixture.ts")).toBeNull();
  });

  it("refuses a lane that only ties its own function budget", () => {
    // The live case this file was blind to: analyze-interview's reasoned 170s lane
    // sat on a 170s function, so the platform kill always won the race and the
    // route never got to log a reason or answer in JSON. `>` let that through.
    expect(budgetViolation(170_000, 170)).toContain("waits 170000ms");
    expect(budgetViolation(170_000, null)).toBe("declares a lane timeout and no maxDuration");
    expect(budgetViolation(166_000, 170)).toContain("waits 166000ms");
    expect(budgetViolation(165_000, 170)).toBeNull();
    expect(budgetViolation(55_000, 60)).toBeNull();
    expect(budgetViolation(200_000, 300)).toBeNull();
  });
});
