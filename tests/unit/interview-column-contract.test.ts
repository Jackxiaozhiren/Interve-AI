// The interviews-table drift this repo shipped for who-knows-how-long had one
// structural cause: src/lib/db.ts Interview is the de-facto row contract, but
// toSnakeCase() forwards its keys to PostgREST with nothing checking that a
// column exists. Six keys had none, so every /setup INSERT died with 42703 and
// was reported to the user as "Database unavailable".
//
// This test is that missing check, as a repo invariant: every field of the row
// contract has a column in the migration set. It cannot see the live database —
// see supabase/migrations/005 for the read-only probes that do.
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";

const DB_TS = new URL("../../src/lib/db.ts", import.meta.url);
const MIGRATIONS = new URL("../../supabase/migrations/", import.meta.url);

const snake = (key: string) => key.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);

/** Own fields of one `export interface X`, minus its index/signature lines. */
function interfaceFields(src: string, name: string): string[] {
  const block = src.match(new RegExp(`export interface ${name} \\{([\\s\\S]*?)\\n\\}`));
  if (!block) throw new Error(`interface ${name} not found`);
  return [...block[1].matchAll(/^\s{2}([a-zA-Z0-9]+)\??:/gm)].map((m) => m[1]);
}

/** Column names `interviews` gains across every migration file. */
function interviewColumns(): { files: string[]; columns: Set<string> } {
  const files: string[] = [];
  const columns = new Set<string>();
  for (const entry of readdirSync(MIGRATIONS).filter((f) => f.endsWith(".sql"))) {
    const sql = readFileSync(new URL(entry, MIGRATIONS), "utf8");
    let touched = false;
    for (const body of sql.matchAll(/CREATE TABLE[^()]*?\binterviews\s*\(([\s\S]*?)\n\);/g)) {
      for (const line of body[1].split("\n")) {
        const m = line.match(/^\s*([a-z_][a-z0-9_]*)\s+[A-Z]/);
        if (m) columns.add(m[1]);
      }
      touched = true;
    }
    for (const m of sql.matchAll(/ALTER TABLE[^;]*?\binterviews[\s\S]*?ADD COLUMN(?: IF NOT EXISTS)?\s+([a-z_][a-z0-9_]*)/gi)) {
      columns.add(m[1]);
      touched = true;
    }
    if (touched) files.push(entry);
  }
  return { files, columns };
}

describe("Interview row contract vs migrations", () => {
  const fields = interfaceFields(readFileSync(DB_TS, "utf8"), "Interview");
  const { files, columns } = interviewColumns();

  it("finds a column for every field the app writes", () => {
    const orphaned = fields.filter((f) => f !== "id" && !columns.has(snake(f)));
    // A failure here means a field was added to src/lib/db.ts without a
    // migration. Postgres will reject the whole row, not just this field.
    expect(orphaned).toEqual([]);
  });

  // Guards against the assertion above passing because a parser silently found
  // nothing, which is how a "green" gate proves nothing.
  it("parses a plausible number of fields and columns", () => {
    expect(fields.length).toBeGreaterThan(20);
    expect(columns.size).toBeGreaterThan(20);
    expect(files.length).toBeGreaterThanOrEqual(2); // both init files + 002 + 005
  });

  it("names the six columns that regressed, so a rename cannot hide them", () => {
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
