/**
 * The route inventory in `docs/audit/ARCHITECTURE_CURRENT.md` is a set of counts,
 * and counts rot.
 *
 * The paragraph reads in present tense — "**Routes (19 pages, 18 APIs):** … + 17
 * POST all via `guardRequest`" — and every one of those four claims was false by
 * the time this file was written: 21 page files, 19 route handlers, 18 POST
 * handlers, and two of the eighteen do not go through the shared guard at all
 * (`csp-report`, which has no session to check, and `parse-resume`, which reads
 * `formData` and therefore hand-rolls the same order). Nothing noticed, because
 * no measurement was pointed at the sentence: `docs-volatile-counts.test.ts`
 * polices totals an outside system moves (deployments), and
 * `readme-architecture-claims.test.ts` polices `README.md`.
 *
 * Agents read this file as the map of the codebase, which is the reason a wrong
 * count in it is not cosmetic: the last audit round started from "all POST go
 * through the guard" and stopped looking for a lane that skipped it.
 *
 * So each number is compared to the thing that owns it. The page count comes from
 * the collector's own `boundaries.pages`, because that is the producer the ratchet
 * already uses; the rest is derived here from the parse tree, and the guard-coverage
 * claim is checked as a *set* — the exceptions are named, so "all" cannot come back
 * by quietly deleting the second half of the sentence.
 */
import ts from "typescript";
import { describe, expect, it } from "vitest";
import { collectFacts } from "../../scripts/audit-facts.mjs";
import { readRepo, walkRepo } from "./repo-tree";
import { expectClaim } from "./doc-claims";

const DOC = "docs/audit/ARCHITECTURE_CURRENT.md";
const doc = readRepo(DOC);

const routeFiles = walkRepo("src/app/api", (rel) => rel.endsWith("route.ts")).sort();

/** Route files exporting a POST handler, read off the tree. */
function postRoutes(): string[] {
  return routeFiles.filter((rel) => {
    const sourceFile = ts.createSourceFile(rel, readRepo(rel), ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
    let found = false;
    const visit = (node: ts.Node) => {
      if (found) return;
      if (ts.isFunctionDeclaration(node) && node.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword)) {
        const name = node.name?.text;
        if (name === "POST") found = true;
      }
      if (ts.isVariableStatement(node) && node.declarationList.declarations.some((d) => ts.isIdentifier(d.name) && d.name.text === "POST")) {
        found = !!node.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword);
      }
      ts.forEachChild(node, visit);
    };
    ts.forEachChild(sourceFile, visit);
    return found;
  });
}

const POSTS = postRoutes();
const GUARDED = POSTS.filter((rel) => readRepo(rel).includes("guardRequest("));
const UNGUARDED = POSTS.filter((rel) => !GUARDED.includes(rel)).map((rel) =>
  rel.replace(/^src\/app\/api\//, "").replace(/\/route\.ts$/, "")
);

// Once, at module scope: `slow-probe-placement.test.ts` forbids this probe inside
// a timed callback, where a file with four arms would pay for it four times.
const facts = collectFacts();

/** Two integers in a fixed phrase, so a reworded sentence fails loudly. */
function pair(pattern: RegExp): [number, number] | null {
  const m = pattern.exec(doc.replace(/\s+/g, " "));
  return m ? [Number(m[1]), Number(m[2])] : null;
}

describe("the architecture doc's route line matches the tree", () => {
  it("reads the sentence it claims to police (instrument sanity)", () => {
    // Without this, a reworded paragraph would make every comparison below pass by
    // finding nothing — the failure mode this file exists to prevent.
    expect(pair(/\*\*Routes \((\d+) pages, (\d+) APIs\):\*\*/), "the Routes sentence moved or was reworded").not.toBeNull();
    expect(pair(/\+\s*(\d+) POST, (\d+) via/), "the POST coverage clause moved or was reworded").not.toBeNull();
    expect(POSTS.length).toBeGreaterThanOrEqual(15);
    expect(routeFiles.length).toBeGreaterThanOrEqual(18);
  });

  it("counts pages and API handlers the way the tree does", () => {
    const claimed = pair(/\*\*Routes \((\d+) pages, (\d+) APIs\):\*\*/) as [number, number];
    expectClaim(claimed[0], facts.capabilities.boundaries.pages, "page");
    expectClaim(claimed[1], routeFiles.length, "API route handler");
  });

  it("counts POST handlers, and how many reach the shared guard", () => {
    const claimed = pair(/\+\s*(\d+) POST, (\d+) via/) as [number, number];
    expectClaim(claimed[0], POSTS.length, "POST handler");
    expectClaim(claimed[1], GUARDED.length, "POST handler routed through guardRequest");
  });

  it("names every POST lane that does not use the shared guard", () => {
    // The claim that was wrong in kind rather than by one: "all via guardRequest"
    // told the next reader there was nothing to look for. Listing the exceptions
    // means a new hand-rolled lane has to be written into this sentence, where a
    // reader meets it, instead of being discovered by an audit.
    //
    // Names are taken from backticks inside the clause, not by splitting the
    // clause on punctuation: the sentence carries a reason after each name, and a
    // splitter turns "`csp-report` (report-only, no session to check)" into a
    // token that matches nothing and reads as a passing check.
    const clause = /the exceptions are([^(]*(?:\([^)]*\)[^.(]*)*)\./i.exec(doc.replace(/\s+/g, " "));
    const named = clause ? [...clause[1].matchAll(/`([a-z0-9-]+)`/g)].map((m) => m[1]).sort() : [];
    expect(clause, "the sentence that names the exceptions is gone").not.toBeNull();
    expect(named, `lanes the doc names (${named.join(", ")}) vs the tree (${UNGUARDED.join(", ")})`).toEqual(
      [...UNGUARDED].sort()
    );
  });
});
