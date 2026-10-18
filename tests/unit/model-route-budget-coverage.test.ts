/**
 * Every route that can spend a model call is inside the daily per-user fuse.
 *
 * `guardRequest` enforces the Unbounded-Consumption fuse (Phase B6) for the
 * fourteen analyzer/chat lanes and refuses the opt-out anywhere in the tree, so
 * the property reads as settled. It is not settled: a route that hand-rolls its
 * pipeline instead of calling the shared guard inherits none of it, and
 * `/api/parse-resume` — the one lane that parses a PDF and can fall back to a
 * vision model, with the longest `maxDuration` of the set — was exactly such a
 * route. Measured before this file existed: 16 model-calling routes, 15 covered,
 * 1 not, bounded only by 10 requests/minute per IP.
 *
 * The population is derived from call syntax, never from a list of route names, so
 * a new model-calling route joins it on the day it is written. Matching calls
 * (not identifiers) keeps a comment from inventing a member; the residual bias is
 * toward requiring coverage on a route that turns out not to spend anything, which
 * is the direction worth failing in.
 */
import { describe, expect, it } from "vitest";
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
