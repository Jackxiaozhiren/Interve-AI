// Ring A ledger for the collector's `orphanApiRoutes` probe
// (scripts/audit-facts.mjs): route handlers with no caller outside their own
// tests. The probe measures, this file adjudicates — a 5th uncalled route fails
// `npm test`, and deleting one forces the list to shrink, so the inventory
// cannot quietly drift into "nobody remembers why".
//
// Not every entry is a defect to fix: `health` exists for an external prober and
// is correct to keep. The other three are product surface no user reaches.
import { describe, it, expect } from "vitest";

import { collectFacts, nameIsCalled, routeCallEvidence } from "../../scripts/audit-facts.mjs";

const KNOWN_ORPHANS: Record<string, string> = {
  // ContinuousLearning.tsx derives the trend chart and its deltas in memory from
  // the session list; the route that would do the same server-side is never
  // fetched. 512KB body cap, rate limit and degradation tests all run on it.
  "analyze-chunk": "resume parsing goes through parse-resume + analyze-alignment; no chunk caller",
  "analyze-trends": "trends computed client-side in ContinuousLearning",
  // Ops endpoint: correct to have no browser caller, but nothing probes it yet —
  // the Dockerfile sets no HEALTHCHECK and docker-compose's healthcheck targets
  // the separate python dsa-api service on :8000/health, not this app.
  health: "pre-wired for container/uptime probes; wire a HEALTHCHECK when deploying",
  // Superseded: interview-chat builds its own context server-side.
  "init-context": "context assembled inside interview-chat; no separate call",
  // Nothing posts reports since the report-only header was deleted: it produced
  // 9-12 console violations per route, including for the framework's own inline
  // script, so its target state was unreachable while the reports went nowhere.
  // Kept rather than removed, and this is why the deletion was cheap — putting a
  // report-only policy back costs one header. See src/proxy.ts:112 and
  // docs/RELEASE_CHECKLIST.md:18.
  "csp-report": "no report-only policy is set any more; endpoint kept so re-adding one costs a header",
};

// One collector run for the whole file: it shells out to git, so calling it per
// assertion would triple the cost for no extra evidence.
const orphans = collectFacts().capabilities.orphanApiRoutes as string[];

describe("orphan API route ledger (collector probe)", () => {
  it("the measured set equals the adjudicated set", () => {
    expect(orphans).toEqual(Object.keys(KNOWN_ORPHANS).sort());
  });

  it("every orphan carries a reason", () => {
    for (const route of orphans) {
      expect(KNOWN_ORPHANS[route], `no adjudication for /api/${route}`).toBeTruthy();
    }
  });

  it("the probe is not blind: a called route never appears", () => {
    // parse-resume is fetched by src/app/setup/page.tsx:368. If this ever lists
    // a route the UI does call, the probe — not the ledger — is wrong.
    expect(orphans).not.toContain("parse-resume");
  });

  it("keeps the two lanes whose caller builds the path off the ledger", () => {
    // `src/lib/interview/turn-analysis.ts:58` posts through a helper that
    // interpolates `/api/${route}`, so no call site ever contains the literal path.
    // Until now these two were counted as called only because a doc comment in
    // `src/lib/interview/analysis-projection.ts:69,92` names them — reword that
    // sentence and two live routes would read as dead. The call shape is the
    // evidence, not the sentence about it.
    expect(orphans).not.toContain("analyze-star");
    expect(orphans).not.toContain("analyze-behavior");
  });

  it("counts call shapes as evidence and prose as not", () => {
    // The predicate, held to both directions on its own rather than through the
    // file set: this is what makes the two arms above mean something. Comments are
    // absent from the parse tree, so the sentence case needs no stripping rule to
    // be honest about.
    const ev = (text: string) => routeCallEvidence(text, "probe.ts");
    expect(nameIsCalled(ev("// the analyze-star lane is deprecated\nconst x = 1;"), "analyze-star")).toBe(false);
    expect(nameIsCalled(ev('/** fetch("/api/csp-report") */\nconst x = 1;'), "csp-report")).toBe(false);
    expect(nameIsCalled(ev('post("analyze-star", { transcript })'), "analyze-star")).toBe(true);
    expect(nameIsCalled(ev('fetch("/api/parse-resume", { method: "POST" })'), "parse-resume")).toBe(true);
    expect(nameIsCalled(ev("const u = `/api/health`;\nexport default () => fetch(u);"), "health")).toBe(true);
    // Naming a lane in a log, or as an object key, is not reaching the endpoint.
    expect(nameIsCalled(ev("console.warn(`analyze-star unavailable`)"), "analyze-star")).toBe(false);
    expect(nameIsCalled(ev('const streams = { "analyze-chunk": [] };'), "analyze-chunk")).toBe(false);
  });
});
