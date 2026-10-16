/**
 * Catalog predicates in the SQL this repo tells a human to paste must compile
 * against the catalog's actual column types.
 *
 * `pg_policies.roles` is `name[]`, not `text[]`. Migration 006 and
 * `scripts/sql/verify-anon-bridge.sql` both compared it with
 * `roles @> ARRAY['anon']::text[]`, and there is no `@>(name[], text[])`
 * operator — so the statement raised `42883 operator does not exist` instead of
 * deciding anything. Measured 2026-10-16 against the deployed project: the
 * uncast form errors, `roles::text[] @> ARRAY['anon']::text[]` returns 7 rows,
 * and `'anon' = ANY(roles)` returns the same 7.
 *
 * That matters more than a typo would, because the predicate is the part 006
 * was written to be right about: step 1 drops names, and steps 2 and 3 are the
 * half that refuses to report success while an anon grant survives. A migration
 * whose guard clause cannot parse is not a guarded migration — it aborts before
 * the drop loop, which is the only outcome worse than a silent pass. Nothing
 * keyless could see it, because no test reads the SQL files as text the way a
 * Postgres parser would.
 */
import { describe, expect, it } from "vitest";
import { readRepo, walkRepo } from "./repo-tree";

const SQL_FILES = [
  ...walkRepo("supabase", (rel) => rel.endsWith(".sql")),
  ...walkRepo("scripts", (rel) => rel.endsWith(".sql")),
];

/** A `roles` compared with `@>` with no cast on the left operand. */
const UNCAST_ROLES_ARRAY_COMPARE = /\broles\s+@>/g;

describe("SQL catalog predicates use the column's real type", () => {
  it("reads a corpus big enough to be worth trusting", () => {
    expect(SQL_FILES.length, "no SQL files found — this arm would pass on blindness").toBeGreaterThanOrEqual(8);
    expect(SQL_FILES).toContain("supabase/migrations/006_close_anon_bridge_content_tables.sql");
  });

  it("never compares pg_policies.roles to a text array without casting it", () => {
    const hits = SQL_FILES.flatMap((rel) => {
      const body = readRepo(rel);
      return [...body.matchAll(UNCAST_ROLES_ARRAY_COMPARE)].map((m) => {
        const line = body.slice(0, m.index).split("\n").length;
        return `${rel}:${line}: ${m[0].trim()} — pg_policies.roles is name[]`;
      });
    });
    expect(hits).toEqual([]);
  });

  it("keeps 006's three steps present, so the fixed predicate is not a deletion", () => {
    // The cheap wrong fix for a guard that errors is to delete the guard. Pin
    // that the migration still names the hole, still drops by predicate, and
    // still refuses to pass with the predicate unmet.
    const m = readRepo("supabase/migrations/006_close_anon_bridge_content_tables.sql");
    expect(m).toMatch(/DROP POLICY IF EXISTS/);
    expect(m).toMatch(/roles::text\[\] @> ARRAY\['anon'\]::text\[\]/);
    expect(m).toMatch(/RAISE EXCEPTION/);
    expect([...m.matchAll(/roles::text\[\] @> ARRAY\['anon'\]::text\[\]/g)].length).toBe(2);
  });
});
