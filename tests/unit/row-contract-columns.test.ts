// The interviews-table drift this repo shipped had one structural cause: the
// interfaces in src/lib/db.ts are the de-facto row contract, but toSnakeCase()
// in src/lib/api-client.ts forwards their keys to PostgREST with nothing
// checking that a column exists. Six Interview keys had none, so every /setup
// INSERT died with Postgres 42703 and was reported to the user as "Database
// unavailable".
//
// This test is that missing check, as a repo invariant over every table the
// client writes to: each contract field has a column in the migration set. It
// cannot see the live database — supabase/migrations/005 documents the read-only
// probes that do, and they are what found the six.
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";

const DB_TS = new URL("../../src/lib/db.ts", import.meta.url);
const MIGRATIONS = new URL("../../supabase/migrations/", import.meta.url);

/** interface name -> table its wrapper writes, per src/lib/api-client.ts */
const CONTRACTS: Record<string, string> = {
  Interview: "interviews",
  CandidateEvaluation: "evaluations",
  PracticeSession: "practice_sessions",
  TelemetryEvent: "telemetry",
  Achievement: "achievements",
  Assessment: "assessments",
  OramaIndexData: "orama_index",
};

const snake = (key: string) => key.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);

/** Own fields of one `export interface X`, minus index/signature lines. */
function interfaceFields(src: string, name: string): string[] {
  const block = src.match(new RegExp(`export interface ${name} \\{([\\s\\S]*?)\\n\\}`));
  if (!block) throw new Error(`interface ${name} not found in src/lib/db.ts`);
  return [...block[1].matchAll(/^\s{2}([a-zA-Z0-9]+)\??:/gm)].map((m) => m[1]);
}

/** Column names a table gains across the whole migration set. */
function columnsOf(table: string): { files: string[]; columns: Set<string> } {
  const files: string[] = [];
  const columns = new Set<string>();
  for (const entry of readdirSync(MIGRATIONS).filter((f) => f.endsWith(".sql"))) {
    const sql = readFileSync(new URL(entry, MIGRATIONS), "utf8");
    let touched = false;
    for (const body of sql.matchAll(
      new RegExp(`CREATE TABLE[^()]*?\\b${table}\\s*\\(([\\s\\S]*?)\\n\\);`, "g")
    )) {
      for (const line of body[1].split("\n")) {
        const m = line.match(/^\s*([a-z_][a-z0-9_]*)\s+[A-Z]/);
        if (m) columns.add(m[1]);
      }
      touched = true;
    }
    for (const m of sql.matchAll(
      new RegExp(`ALTER TABLE[^;]*?\\b${table}[\\s\\S]*?ADD COLUMN(?: IF NOT EXISTS)?\\s+([a-z_][a-z0-9_]*)`, "gi")
    )) {
      columns.add(m[1]);
      touched = true;
    }
    if (touched) files.push(entry);
  }
  return { files, columns };
}

const src = readFileSync(DB_TS, "utf8");

for (const [iface, table] of Object.entries(CONTRACTS)) {
  describe(`${table}: row contract vs migrations`, () => {
    const fields = interfaceFields(src, iface);
    const { files, columns } = columnsOf(table);

    it("finds a column for every field the app writes", () => {
      const orphaned = fields.filter((f) => f !== "id" && !columns.has(snake(f)));
      // Failing here means a field was added to src/lib/db.ts without a
      // migration. Postgres rejects the whole row, not just that field.
      expect(orphaned).toEqual([]);
    });

    // Guards the assertion above from passing because a parser silently found
    // nothing — that is how a "green" gate proves nothing.
    it("parses a plausible number of fields and columns", () => {
      expect(fields.length).toBeGreaterThan(2);
      expect(columns.size).toBeGreaterThan(2);
      expect(files.length).toBeGreaterThanOrEqual(1);
    });
  });
}

// Named explicitly so a silent rename of the six regressed columns cannot pass
// the loop above by moving them out of the contract instead of into the schema.
describe("the six columns that regressed", () => {
  const { columns } = columnsOf("interviews");
  it("all exist", () => {
    for (const col of [
      "interview_type",
      "custom_type_description",
      "difficulty",
      "time_budget_sec",
      "plan",
      "evaluation_v2",
    ]) {
      expect(columns.has(col), col).toBe(true);
    }
  });
});
