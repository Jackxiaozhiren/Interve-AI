// supabase/migrations/README.md is the authority for which file to run and in
// what order — it is also the only thing standing between a fresh project and
// the frozen 0001 (UUID keys) instead of 001 (BIGSERIAL), which the whole client
// assumes (src/lib/db.ts:22). Prose like this goes stale the moment a file is
// added, and I did it myself: 005 landed and the list still stopped at 004.
//
// It went stale in the other direction too, and less harmlessly. After the live
// catalog was read on 2026-10-12, this document still claimed 005 had been applied
// nowhere and 006 was merely drafted — while the dump showed 005's six columns
// present and 006's anon bridge intact on all five content tables. A run-order
// document that contradicts the database it orders is worse than no document, so
// each entry's status is now compared against
// docs/audit/anon-bridge-evidence.json rather than restated from memory.
//
// Green-on-arrival note: the list arms pass because the README was corrected
// first, so they are not evidence of a caught bug. Their bite is proven by the
// last two tests, which feed the same readers a hypothetical added migration and a
// contradicted status, instead of writing into the repo — a temp file here would
// race the other spec files that read this directory.
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { anonBridgeTables } from "../../scripts/derive-policy-state.mjs";

const DIR = new URL("../../supabase/migrations/", import.meta.url);
const readme = () => readFileSync(new URL("README.md", DIR), "utf8");
const CATALOG = JSON.parse(
  readFileSync(new URL("../../docs/audit/anon-bridge-evidence.json", import.meta.url), "utf8")
) as {
  status: string;
  columns005?: { present?: string[] };
  pgPolicies?: { rows?: { table: string; policy: string; roles?: string; qual?: string }[] };
};

/** The five tables 006 exists to close, and the two whose bridge is deliberate. */
const CLOSED_TABLES = ["interviews", "evaluations", "practice_sessions", "assessments", "orama_index"];

/** Every numbered migration file a fresh project should run, excluding frozen 0001. */
const runnable = () =>
  readdirSync(DIR)
    .filter((f) => /^\d+_.*\.sql$/.test(f) && !f.startsWith("0001_"))
    .sort();

const unlisted = (files: string[], text: string) => files.filter((f) => !text.includes(f));

/**
 * Does a status slot claim the migration is deployed?
 *
 * Keyed on negation rather than on one spelling, because the phrase this
 * document used for years — `未在任何环境应用` — does not contain the substring
 * `未应用` that a name-grepping detector looks for. Reading for that substring
 * classified a "nowhere applied" slot as deployed, which is the one direction
 * that lets a stale run-order document pass. A slot that neither says 应用 nor
 * carries 未 is ambiguous and counts as *not* claiming deployment, so it reddens
 * against an applied catalog instead of passing quietly.
 */
const slotClaimsApplied = (slot: string) => /应用/.test(slot) && !/未/.test(slot);

/**
 * The entries whose slot must agree with a measured fact, each with the fact
 * expressed once.
 *
 * Both sides of a coupling live here so the proof-of-bite below and the coupling
 * arms cannot drift apart: a second copy of the predicate would let the flip test
 * certify a comparison the document no longer makes.
 */
const COUPLINGS: {
  label: string;
  file: string;
  /** The catalog's answer, derived from the artifact, never remembered. */
  applied: () => boolean;
  /** How to name that answer in a failure message, from the value it produced. */
  witness: (applied: boolean) => string;
}[] = [
  {
    label: "005",
    file: "005_interview_session_columns.sql",
    // Measured, not remembered: 005's six columns were read out of
    // information_schema.columns on 2026-10-12 and recorded in the evidence
    // artifact. This file claimed "未在任何环境应用" after that — a run-order
    // document asserting the opposite of the database it describes.
    applied: () => (CATALOG.columns005?.present?.length ?? 0) >= 6,
    witness: (applied) => `the catalog measured ${applied ? "all six columns present" : "the columns missing"}`,
  },
  {
    label: "006",
    file: "006_close_anon_bridge_content_tables.sql",
    // 006 has no columns to look for: its deployed state *is* whether the anon
    // bridge it drops is still in the dump.
    applied: () => anonBridgeTables(CATALOG.pgPolicies?.rows ?? [], CLOSED_TABLES).length === 0,
    witness: (applied) => `the dump shows the bridge ${applied ? "closed" : "open"}`,
  },
];

/**
 * The bold `**状态：…**` slot that follows one migration's filename.
 *
 * A slot rather than a substring search, because the document legitimately
 * *quotes* the claim it has retracted: 005's entry explains that "未在任何环境
 * 应用" was a September point-probe. Grepping the phrase would read the
 * retraction as the status.
 */
function statusOf(text: string, file: string): string | null {
  const at = text.indexOf(file);
  if (at < 0) return null;
  const m = /\*\*状态：([^*]+)\*\*/.exec(text.slice(at, at + 1400));
  return m ? m[1].trim() : null;
}

describe("migrations README vs the files on disk", () => {
  it("lists every migration a fresh project should run", () => {
    const missing = unlisted(runnable(), readme());
    expect(missing, `unlisted: ${missing.join(", ")}`).toEqual([]);
  });

  it("lists them in ascending numeric order", () => {
    const text = readme();
    const positions = runnable().map((f) => text.indexOf(f));
    expect(positions).toEqual([...positions].sort((a, b) => a - b));
  });

  it("keeps the frozen file out of the run order", () => {
    const text = readme();
    const listBlock = text.slice(0, text.indexOf("## 冻结文件"));
    expect(listBlock).not.toContain("0001_initial_schema.sql");
  });

  it("states each migration's deployment status in the slot the guard reads", () => {
    expect(statusOf(readme(), "005_interview_session_columns.sql"), "005 has no **状态：…** slot").toBeTruthy();
    expect(statusOf(readme(), "006_close_anon_bridge_content_tables.sql"), "006 has no **状态：…** slot").toBeTruthy();
  });

  for (const c of COUPLINGS) {
    it(`agrees with the catalog about ${c.label}`, () => {
      const status = statusOf(readme(), c.file) ?? "";
      const applied = c.applied();
      expect(slotClaimsApplied(status), `README says "${status}", ${c.witness(applied)}`).toBe(applied);
    });
  }

  // A gate nobody can turn red is decoration.
  it("would report an added migration as unlisted", () => {
    expect(unlisted([...runnable(), "006_future.sql"], readme())).toEqual(["006_future.sql"]);
  });

  it("would report a status that contradicts the catalog", () => {
    // The coupling arms read a slot out of the document; this feeds the same
    // reader a document whose slot says the opposite. Built from the current
    // wording rather than hardcoded to it, so it keeps biting however the entry
    // is phrased today — which it needed, since 006's slot moved from drafted to
    // applied on 2026-10-16 while 005's never did.
    const text = readme();
    for (const c of COUPLINGS) {
      const current = statusOf(text, c.file) ?? "";
      expect(current, `${c.label} has no status slot to contradict`).toBeTruthy();
      const contradicted = text.replace(
        `**状态：${current}**`,
        `**状态：${/未/.test(current) ? "已应用" : "已起草、未在任何环境应用"}**`
      );
      expect(contradicted, `flipping ${c.label}'s slot did not change the document`).not.toBe(text);
      const flipped = statusOf(contradicted, c.file) ?? "";
      expect(slotClaimsApplied(flipped) === c.applied(), `${c.label}: a flipped status slipped through the same comparison`).toBe(false);
    }
  });
});
