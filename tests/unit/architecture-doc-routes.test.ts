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
import { MODEL_IDS } from "@/ai/providers/registry";
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

/**
 * The assessment sections of the same document — the ones with a status label in
 * the heading — carried four claims the code had already left behind. Two of them
 * were not merely stale numbers: the section said an unsigned cookie could be
 * forged past the proxy gate, and the section said there was no evaluation
 * harness. A reader who believes the first wastes a round hunting a vulnerability
 * that is closed; a reader who believes the second builds one that already exists.
 *
 * Each rule is a pure predicate over text plus a fixture that shows it can fire,
 * because the document has already been corrected: an assertion that only passes
 * today is a description, not a guard.
 */
describe("the architecture doc's assessment sections agree with the code", () => {
  const proxy = readRepo("src/proxy.ts");
  const registry = readRepo("src/ai/providers/registry.ts");

  /**
   * A sentence that still asserts the bypass, as opposed to one recording that it
   * was closed. Keyed per sentence rather than per file: this section's honest text
   * names the old `JSON.parse(cookie).id` check to say it is gone, and a guard that
   * indicts a negation gets routed around — the reader deletes the sentence that
   * explains the fix instead of fixing anything.
   */
  const claimsBypass = (text: string) =>
    text
      .split(/(?<=[.!?])\s+/)
      .some(
        (sentence) =>
          /bypass(es)?\b/i.test(sentence) &&
          !/\b(gone|no longer|never|not\b|removed|closed|fixed|retired)\b/i.test(sentence)
      );

  it("does not describe a cookie bypass while the proxy verifies signatures", () => {
    // Flip condition: this passes because `verifySessionCookie` is called before
    // the gate. If that call ever disappears the arm below fails and says so —
    // the fix is to restore the verification, not to delete the sentence.
    expect(proxy, "src/proxy.ts no longer verifies the session cookie — restore it, then re-read this section").toContain(
      "verifySessionCookie("
    );
    const section = /### 2\.4 Auth[\s\S]*?(?=\n### )/.exec(doc);
    expect(section, "the auth section vanished; this guard is looking for it").not.toBeNull();
    expect(claimsBypass(section?.[0] ?? ""), "the auth section claims a cookie can be forged past the gate").toBe(false);
    expect(claimsBypass("- Live: `proxy.ts` JSON.parse(cookie).id — forge {\"id\":\"x\"} bypasses")).toBe(true);
  });

  it("calls a deleted file deleted, and a wired file wired", () => {
    const gone = ["src/lib/auth-context.tsx", "src/lib/auth/auth.ts"];
    for (const rel of gone) {
      expect(walkRepo("src", (r) => r === rel), `${rel} is back; the doc says it was retired`).toEqual([]);
    }
    // The same section once said `src/lib/auth.ts` had no OAuth wiring. It is the
    // only path that opens a real provider session, so the claim was backwards.
    const auth = readRepo("src/lib/auth.ts");
    expect(auth).toMatch(/signInWithOAuth/);
    expect(auth).toMatch(/signOut/);
    const section = /### 2\.4 Auth[\s\S]*?(?=\n### )/.exec(doc)?.[0] ?? "";
    expect(section, "the auth section says OAuth is unwired again").not.toMatch(/never wired|not wired/);
  });

  it("keeps the model-id single source true, including its own wording", () => {
    // Re-derived the way the rest of this file measures: identifiers and string
    // literals in the tree, never a sentence. The doc used to count 13 files by
    // grepping text, which counted measurement comments as call sites.
    const ids = Object.values(MODEL_IDS) as string[];
    const offenders = walkRepo("src", (rel) => /\.tsx?$/.test(rel) && rel !== "src/ai/providers/registry.ts").filter(
      (rel) => {
        const sf = ts.createSourceFile(rel, readRepo(rel), ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
        let hit = false;
        const visit = (n: ts.Node) => {
          if ((ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n)) && ids.includes(String(n.text))) hit = true;
          ts.forEachChild(n, visit);
        };
        ts.forEachChild(sf, visit);
        return hit;
      }
    );
    expect(offenders, `files hardcoding a model id: ${offenders.join(", ")}`).toEqual([]);
    const section = /### 2\.5 AI Provider[\s\S]*?(?=\n### )/.exec(doc)?.[0] ?? "";
    expect(section, "the provider section claims model ids are hardcoded in N files again").not.toMatch(/hardcoded across \d+ files/);
    expect(section, "and it must still point at the one table that owns them").toMatch(/registry\.ts/);
  });

  it("does not deny the evaluation harness that CI runs", () => {
    const pkg = JSON.parse(readRepo("package.json")) as { scripts: Record<string, string> };
    expect(pkg.scripts["test:eval"], "the eval script is gone — re-read this section before deleting the claim").toBeTruthy();
    expect(pkg.scripts["test:eval:free"]).toBeTruthy();
    expect(walkRepo(".github/workflows", (rel) => rel.endsWith("nightly-eval.yml"))).toHaveLength(1);
    const section = /### 2\.6 AI Evaluation[\s\S]*?(?=\n### )/.exec(doc)?.[0] ?? "";
    expect(section, "the evaluation section says there is no harness again").not.toMatch(/[Nn]o eval harness|no harness, no/);
    expect(section, "the heading must stop advertising the gap the scripts close").not.toMatch(/no harness/);
  });

  it("counts the mock question bank the way the tree does", () => {
    // The doc states a number; the number is checkable, so it is checked. Array
    // length off the parse tree — a text count of `question:` finds zero, because
    // that is not the field name.
    const sf = ts.createSourceFile("qb.ts", readRepo("src/lib/question-bank.ts"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
    let elements = -1;
    const visit = (n: ts.Node) => {
      if (ts.isVariableDeclaration(n) && n.name.getText(sf) === "mockQuestionBank" && n.initializer && ts.isArrayLiteralExpression(n.initializer)) {
        elements = n.initializer.elements.length;
      }
      ts.forEachChild(n, visit);
    };
    ts.forEachChild(sf, visit);
    expect(elements).toBeGreaterThan(0);
    const claimed = /ships (\d+) static mock questions/.exec(doc);
    expect(claimed, "the doc no longer states the mock bank count where this test reads it").not.toBeNull();
    expect(Number(claimed?.[1]), `doc says ${claimed?.[1]}, the array holds ${elements}`).toBe(elements);
  });

  it("keeps the provider fetch hack at one definition", () => {
    const definitions = (registry.match(/async function thinkingFetch/g) ?? []).length;
    expect(definitions, "the thinking/max_tokens hack was duplicated again").toBe(1);
    const section = /### 2\.5 AI Provider[\s\S]*?(?=\n### )/.exec(doc)?.[0] ?? "";
    expect(section, "the doc still counts four copies of a hack that exists once").not.toMatch(/duplicated in 4 files/);
  });
});
