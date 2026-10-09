/**
 * A catch that logs a constant and drops the error cannot be read later.
 *
 * PR #68 closed this on the streaming path: `interview-chat` logged `status: 200`
 * and discarded the failure, so an `AI_NoOutputGeneratedError` was
 * indistinguishable from a 429 or an abort after the fact. Measured across every
 * route file under `src/app/api` with a parse tree: 19 catch blocks call
 * `logApi`,
 * and 15 of them name the error they caught through `classifyUpstreamError`.
 * Four do not: `analyze-trends` at its output-coercion site and both of its
 * fallback paths, and `copilot` at its JSON-coercion site. Each records a policy
 * token — `output_coerced`, `fallback`, `json_coerced` — which says *what the
 * route decided* and nothing about *what happened*, so a provider outage, a
 * cancelled request and a malformed completion all read the same in the logs.
 *
 * The rule is not "never write `catch {`". Plenty of those are correct: a
 * `JSON.parse` probe, an optional storage read, a `catch { return null }`. The
 * rule is narrower and entirely mechanical — **if a catch logs, it has to
 * classify the error it caught** — because a log line is the record future
 * readers will reason from.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import ts from "typescript";
import { describe, expect, it } from "vitest";

interface LoggingCatch {
  file: string;
  line: number;
  binding: string | null;
  classifies: boolean;
}

function routeFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(new URL(`../../${dir}`, import.meta.url))) {
    const rel = `${dir}/${entry}`;
    if (statSync(new URL(`../../${rel}`, import.meta.url)).isDirectory()) out.push(...routeFiles(rel));
    else if (rel.endsWith("route.ts")) out.push(rel);
  }
  return out;
}

function loggingCatches(rel: string, src: string): LoggingCatch[] {
  const sf = ts.createSourceFile(rel, src, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const found: LoggingCatch[] = [];

  // A route may log through a local wrapper — `parse-resume` has `done()`, which
  // formats and emits the single terminal line. Resolving those aliases in-file
  // is what keeps the rule from being dodged by one level of indirection.
  const loggers = new Set<string>(["logApi"]);
  const collectAliases = (node: ts.Node) => {
    const name =
      ts.isFunctionDeclaration(node) && node.name
        ? node.name.text
        : ts.isVariableDeclaration(node) && ts.isIdentifier(node.name)
          ? node.name.text
          : null;
    const body =
      ts.isFunctionDeclaration(node) && node.body
        ? node.body.getText(sf)
        : ts.isVariableDeclaration(node) && node.initializer
          ? node.initializer.getText(sf)
          : "";
    if (name && /logApi\s*\(/.test(body)) loggers.add(name);
    node.forEachChild(collectAliases);
  };
  collectAliases(sf);
  const logs = new RegExp("(?:" + [...loggers].join("|") + ")\\s*\\(");

  const visit = (node: ts.Node) => {
    if (ts.isCatchClause(node) && logs.test(node.block.getText(sf))) {
      const binding = node.variableDeclaration?.name.getText(sf) ?? null;
      // Must be the classifier applied to *this* error. `classifyUpstreamError(e)`
      // inside a catch that bound `err` would satisfy a substring check and still
      // report the wrong thing.
      const classifies =
        binding !== null &&
        new RegExp(`classifyUpstreamError\\s*\\(\\s*${binding}\\s*\\)`).test(node.block.getText(sf));
      found.push({
        file: rel,
        line: sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1,
        binding,
        classifies,
      });
    }
    node.forEachChild(visit);
  };

  visit(sf);
  return found;
}

const CATCHES = routeFiles("src/app/api").flatMap((f) => loggingCatches(f, readFileSync(new URL(`../../${f}`, import.meta.url), "utf8")));

describe("a catch that logs must classify the error it caught", () => {
  it("finds logging catches, most of them already classified", () => {
    // Non-vacuity in both directions, derived from the scan: zero sites would
    // make the rule below pass on nothing, and zero classified sites would mean
    // the predicate never has anything true to say.
    expect(CATCHES.length).toBeGreaterThan(0);
    expect(CATCHES.filter((c) => c.classifies).length).toBeGreaterThan(0);
  });

  it("has no logging catch left unclassified", () => {
    // One assertion over the whole inventory rather than `it.each` over the
    // offenders: an empty `each` registers no test at all, so the case would
    // quietly stop existing the moment it started passing.
    const offenders = CATCHES.filter((c) => !c.classifies);
    expect(
      offenders.map((c) => `${c.file}:${c.line} binding=${c.binding ?? "(none)"}`),
      "these log a policy token and throw the error away"
    ).toEqual([]);
  });

  it("reads the shape, so the rule cannot be satisfied by an unrelated call", () => {
    const classifyIn = (src: string) => loggingCatches("fixture.ts", src);

    const good = classifyIn(`
async function POST() {
  try { return await generateText(); } catch (e) {
    logApi(R, { requestId, status: 500, reason: classifyUpstreamError(e) });
  }
}`);
    expect(good).toHaveLength(1);
    expect(good[0].classifies).toBe(true);

    const bare = classifyIn(`
async function POST() {
  try { return await generateText(); } catch {
    logApi(R, { requestId, status: 200, reason: "fallback" });
  }
}`);
    expect(bare).toHaveLength(1);
    expect(bare[0].binding, "the defect: no binding, so nothing can be named").toBeNull();
    expect(bare[0].classifies).toBe(false);

    const wrongError = classifyIn(`
async function POST(req: Request) {
  const e = new Error("unrelated");
  try { return await generateText(); } catch (err) {
    logApi(R, { requestId, status: 500, reason: classifyUpstreamError(e) });
  }
}`);
    expect(wrongError).toHaveLength(1);
    expect(
      wrongError[0].classifies,
      "classifying a different object is the same silence with a call site"
    ).toBe(false);

    const silent = classifyIn(`
function probe() {
  try { return JSON.parse(x); } catch { return null; }
}`);
    expect(silent, "a catch that does not log is not this rule's business").toEqual([]);

    const viaAlias = classifyIn(`
function done(status: number, extra: object) {
  logApi(R, { requestId, status, ...extra });
}
async function POST() {
  try { return await generateText(); } catch {
    done(422, { reason: "ocr_failed" });
  }
}`);
    expect(
      viaAlias,
      "logging through a local wrapper must not hide the catch from the rule"
    ).toHaveLength(1);
    expect(viaAlias[0].classifies).toBe(false);

    // The shape `parse-resume` actually uses: an arrow const, not a declaration.
    const viaArrowAlias = classifyIn(`
async function POST() {
  const done = (status: number, extra?: { reason?: string }) =>
    logApi(ROUTE, { requestId, status, ...extra });
  try { return await generateText(); } catch {
    done(422, { reason: "ocr_failed" });
  }
}`);
    expect(viaArrowAlias, "an arrow-function alias is the same indirection").toHaveLength(1);
    expect(viaArrowAlias[0].classifies).toBe(false);
  });
});
