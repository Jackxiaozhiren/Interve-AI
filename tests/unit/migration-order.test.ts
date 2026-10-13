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

  it("agrees with the catalog about 005", () => {
    // Measured, not remembered: 005's six columns were read out of
    // information_schema.columns on 2026-10-12 and recorded in the evidence
    // artifact. This file claimed "未在任何环境应用" after that — a run-order
    // document asserting the opposite of the database it describes.
    const status = statusOf(readme(), "005_interview_session_columns.sql") ?? "";
    const applied = (CATALOG.columns005?.present?.length ?? 0) >= 6;
    expect(/已应用/.test(status) && !/未/.test(status), `README says "${status}", catalog measured ${applied ? "applied" : "not applied"}`).toBe(applied);
  });

  it("agrees with the catalog about 006", () => {
    const status = statusOf(readme(), "006_close_anon_bridge_content_tables.sql") ?? "";
    const bridgeOpen = anonBridgeTables(CATALOG.pgPolicies?.rows ?? [], CLOSED_TABLES).length > 0;
    expect(/未应用/.test(status), `README says "${status}", the dump shows the bridge ${bridgeOpen ? "open" : "closed"}`).toBe(bridgeOpen);
  });

  // A gate nobody can turn red is decoration.
  it("would report an added migration as unlisted", () => {
    expect(unlisted([...runnable(), "006_future.sql"], readme())).toEqual(["006_future.sql"]);
  });

  it("would report a status that contradicts the catalog", () => {
    // The two coupling arms read a slot out of the document; this feeds the same
    // reader a document whose slot says the opposite. Built from the current
    // wording rather than hardcoded to it, so it keeps biting however the entry
    // is phrased today.
    const text = readme();
    const current = statusOf(text, "005_interview_session_columns.sql") ?? "";
    expect(current, "no 005 status slot exists to contradict").toBeTruthy();
    const contradicted = text.replace(
      `**状态：${current}**`,
      `**状态：${/未/.test(current) ? "已应用" : "已起草、未在任何环境应用"}**`
    );
    expect(contradicted, "flipping the slot did not change the document").not.toBe(text);
    const flipped = statusOf(contradicted, "005_interview_session_columns.sql") ?? "";
    const applied = (CATALOG.columns005?.present?.length ?? 0) >= 6;
    expect((/已应用/.test(flipped) && !/未/.test(flipped)) === applied, "a flipped status slipped through the same comparison").toBe(false);
  });
});
