/**
 * Every route that can spend a model call is inside the daily per-user fuse, and
 * every call it spends is handed an abort signal.
 *
 * `guardRequest` enforces the Unbounded-Consumption fuse (Phase B6) for the
 * fourteen analyzer/chat lanes and refuses the opt-out anywhere in the tree, so
 * the property reads as settled. It is not settled: a route that hand-rolls its
 * pipeline instead of calling the shared guard inherits none of it, and
 * `/api/parse-resume` — the one lane that parses a PDF and can fall back to a
 * vision model, with the longest `maxDuration` of the set — was exactly such a
 * route. Measured before this file existed: 16 model-calling routes, 15 covered,
 * 1 not, bounded only by 10 requests/minute per IP. The same route was also the
 * only one of sixteen model calls that passed no signal, which is the second
 * half of the same blind spot: hand-rolling the pipeline skips whatever the
 * shared guard would have built for you.
 *
 * The population is derived from call syntax, never from a list of route names, so
 * a new model-calling route joins it on the day it is written. Matching calls
 * (not identifiers) keeps a comment from inventing a member; the residual bias is
 * toward requiring coverage on a route that turns out not to spend anything, which
 * is the direction worth failing in.
 */
import { describe, expect, it } from "vitest";
import ts from "typescript";
import { readRepo, walkRepo } from "./repo-tree";

const MODEL_CALL = /\b(?:generateText|generateObject|streamText|embedText|embedMany)\s*(?:<[^>]*>)?\s*\(/;
const GUARDED = /guardRequest\s*\(/;
const FUSE = /checkUserBudget\s*\(/;

const routeFiles = walkRepo("src/app/api", (rel) => rel.endsWith("route.ts")).sort();
const modelRoutes = routeFiles.filter((rel) => MODEL_CALL.test(readRepo(rel)));
const uncovered = modelRoutes.filter(
  (rel) => !GUARDED.test(readRepo(rel)) && !FUSE.test(readRepo(rel))
);
const optOuts = routeFiles.filter((rel) => /userBudget:\s*false/.test(readRepo(rel)));

describe("the daily per-user AI budget covers every route that can spend one", () => {
  it("finds the model-calling routes it claims to (instrument sanity)", () => {
    // The assertion below is a filter over this set: an empty set is a green that
    // means nothing, so the set itself is pinned. `walkRepo` returning nothing
    // would otherwise look like full coverage.
    expect(routeFiles.length, "no API routes found — the derivation below is vacuous").toBeGreaterThanOrEqual(15);
    expect(modelRoutes.length, "no route matched a model call — the regex, not the code, changed").toBeGreaterThanOrEqual(12);
  });

  it("has the fuse in the shared guard the coverage argument relies on", () => {
    // "Covered by guardRequest" is only a fact if guardRequest actually calls the
    // fuse. Read it from the source rather than from the comment that says so.
    expect(FUSE.test(readRepo("src/lib/api/guard.ts")), "guardRequest no longer enforces checkUserBudget").toBe(true);
  });

  it("leaves no model-calling route outside the fuse", () => {
    expect(
      uncovered.map((rel) => rel.replace(/^src\/app\/api\//, "").replace(/\/route\.ts$/, "")),
      `these routes reach a model but enforce neither guardRequest nor checkUserBudget: ${uncovered.join(", ")}`
    ).toEqual([]);
  });

  it("carries no silent opt-out", () => {
    // Zero today. If a route ever needs to opt out, it has to be argued here —
    // in the open — rather than by writing `userBudget: false` in a route file.
    expect(optOuts, `routes that opted out of the fuse: ${optOuts.join(", ")}`).toEqual([]);
  });
});

/**
 * The same derived population carries a second property, and `/api/parse-resume`
 * was the only route failing it too: every model call has to be handed an abort
 * signal, or a stalled provider call runs until the platform kills the function.
 * That route declares `maxDuration = 100` with a comment saying the number is
 * there because a mid-call platform kill hands the client a body it cannot parse
 * as JSON — but nothing in the code aborted the wait, so the kill was still the
 * only timeout, and an upload the user abandoned kept spending the shared free
 * tier. Every other lane avoids that by passing `gate.ctx.signal`, which
 * `guardRequest` builds from the client disconnect plus its own lane budget.
 *
 * Checked per call site off the parse tree, not per file: a route that aborts one
 * call and not the other is the case worth catching.
 */
describe("every model call is handed an abort signal", () => {
  const MODEL_FNS = new Set(["generateText", "generateObject", "streamText", "embedText", "embedMany"]);

  /** Call sites in one source text: every line that reaches a model, and the
   *  subset of those whose own options object carries no `abortSignal`. */
  function modelCalls(sourceText: string, fileName: string): { total: number[]; missing: number[] } {
    const sourceFile = ts.createSourceFile(
      fileName,
      sourceText,
      ts.ScriptTarget.Latest,
      /* setParentNodes */ true,
      ts.ScriptKind.TS
    );
    const total: number[] = [];
    const missing: number[] = [];
    const lineOf = (node: ts.Node) =>
      sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1;
    const visit = (node: ts.Node) => {
      if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && MODEL_FNS.has(node.expression.text)) {
        total.push(lineOf(node));
        const options = node.arguments[0];
        const carries =
          !!options &&
          ts.isObjectLiteralExpression(options) &&
          options.properties.some(
            (p) => p.name !== undefined && ts.isIdentifier(p.name) && p.name.text === "abortSignal"
          );
        if (!carries) missing.push(lineOf(node));
      }
      ts.forEachChild(node, visit);
    };
    ts.forEachChild(sourceFile, visit);
    return { total, missing };
  }

  it("finds the call sites it claims to (instrument sanity)", () => {
    const total = modelRoutes.reduce((n, rel) => n + modelCalls(readRepo(rel), rel).total.length, 0);
    // Sixteen calls across fifteen lanes today. A filter over an empty list would
    // report perfect discipline in a tree where the detector found nothing.
    expect(total, "no model call parsed — the syntax, not the code, changed").toBeGreaterThanOrEqual(15);
  });

  it("passes a signal at every one of them", () => {
    const offenders = modelRoutes
      .map((rel) => ({ rel, lines: modelCalls(readRepo(rel), rel).missing }))
      .filter((o) => o.lines.length > 0)
      .map((o) => `${o.rel}:${o.lines.join(",")}`);
    expect(offenders, `model calls with no abortSignal:\n  ${offenders.join("\n  ")}`).toEqual([]);
  });

  it("reads the signal off the call that needs it, not off the file", () => {
    // One call wired and one not: the file mentions the property, and so does the
    // prose, and neither may certify the second call.
    const two = `
      // every model call is handed an abortSignal from guardRequest
      const a = await generateText({ model, prompt, abortSignal: signal });
      const b = await generateObject({ schema, prompt });
    `;
    expect(modelCalls(two, "two.ts")).toEqual({ total: [3, 4], missing: [4] });
    expect(modelCalls(`const b = await generateObject({ schema, prompt });`, "one.ts").missing).toEqual([1]);
    // Shorthand still counts: the property is on the call, whatever it is spelled with.
    expect(modelCalls(`const b = await generateText({ model, prompt, abortSignal });`, "ok.ts").missing).toEqual([]);
  });
});
