// Ring A ledger for the collector's `orphanApiRoutes` probe
// (scripts/audit-facts.mjs): route handlers with no caller outside their own
// tests. The probe measures, this file adjudicates — a 5th uncalled route fails
// `npm test`, and deleting one forces the list to shrink, so the inventory
// cannot quietly drift into "nobody remembers why".
//
// Not every entry is a defect to fix: `health` exists for an external prober and
// is correct to keep. The other three are product surface no user reaches.
import { describe, it, expect } from "vitest";

import { collectFacts } from "../../scripts/audit-facts.mjs";

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
});
