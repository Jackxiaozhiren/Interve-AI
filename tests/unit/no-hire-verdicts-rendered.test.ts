// N2: the product may not tell anyone whether to hire this person.
//
// The evaluation contract already refuses to *produce* council verdicts
// (`evaluation-contract.test.ts` bans the keys), but the legacy display path kept
// rendering whatever an old row held: a stance of `no_hire` in a big red label,
// next to a quoted justification. Enforcement stopped at the schema and never
// reached the surface.
//
// Production held zero rows when this was written (2026-10-31, SQL Editor, owner
// run), so removing the paths destroys no one's report. That is the only reason
// this could be done safely; with rows present it would need a migration.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { toEvaluationView } from "../../src/lib/eval-compat";

const SURFACES = [
  "src/components/dashboard/SessionDetailModal.tsx",
  "src/components/dashboard/PrintableDossier.tsx",
  "src/components/interview/PrintLayout.tsx",
  "src/lib/utils/export.ts",
  "src/app/dashboard/report/[id]/page.tsx",
];

describe("no employment verdict reaches a user-facing surface", () => {
  for (const rel of SURFACES) {
    it(`${rel} renders no advisor stance`, () => {
      // Comments and prose are stripped first: a file is allowed to explain the
      // rule it is following, and the harm is in what reaches a screen, not in
      // what a maintainer wrote next to it.
      const text = readFileSync(rel, "utf8")
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/^\s*\/\/.*$/gm, "");
      expect(
        text.match(/stance/gi) ?? [],
        `${rel} still renders an advisor stance; a stance is a hire verdict with a different label`,
      ).toEqual([]);
      expect(
        text.match(/cultureFitAdvisor/g) ?? [],
        `${rel} still reads the culture-fit advisor`,
      ).toEqual([]);
    });
  }
});

describe("the verdict cannot come back through the readiness label", () => {
  it("a legacy row with a hire verdict reports no readiness at all", () => {
    // Removing the council card was half the job: `readinessLabel` carried the same
    // verdict as the string "No Hire (legacy)" into EvaluationView, the dashboard
    // list and the printable dossier, where nothing scans for the word "stance".
    const view = toEvaluationView({
      id: "legacy-1",
      name: "Candidate",
      role: "Frontend",
      level: "Mid",
      date: "2026-10-01",
      duration: 1800,
      hireVerdict: "no_hire",
      verdictRationale: "not enough signal",
      transcript: [],
    } as unknown as Parameters<typeof toEvaluationView>[0]);

    expect(view.readinessLabel).toBeNull();
  });
});
