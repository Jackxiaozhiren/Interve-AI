// Phase 2: migration-contract tests for RLS + ownership (P0-2, P0-5).
//
// Static contract tests (no live DB): they pin the security invariants of
// the migration files so a future edit cannot silently re-open access.
// Live RLS behavior tests require a staging Supabase project and are
// tracked in STABILIZATION_REPORT (Phase 3 prerequisite).
import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";

const ROOT = new URL("../../", import.meta.url);
const read = (p: string) => readFileSync(new URL(p, ROOT), "utf8");

const TABLES = [
  "interviews",
  "evaluations",
  "practice_sessions",
  "telemetry",
  "achievements",
  "orama_index",
  "assessments",
];

describe("migration history", () => {
  it("keeps 0001/001 for history and adds additive 002", () => {
    expect(existsSync(new URL("supabase/migrations/0001_initial_schema.sql", ROOT))).toBe(true);
    expect(existsSync(new URL("supabase/migrations/001_init_schema.sql", ROOT))).toBe(true);
    expect(existsSync(new URL("supabase/migrations/002_session_ownership.sql", ROOT))).toBe(true);
  });

  // H2.1: 003/004 are part of the pinned history (cutover 005 stays
  // ungenerated until live dual-user denial exists — see phase report).
  it("pins 003/004 presence (additive chain unbroken)", () => {
    expect(existsSync(new URL("supabase/migrations/003_per_operation_policies.sql", ROOT))).toBe(true);
    expect(existsSync(new URL("supabase/migrations/004_practice_evidence.sql", ROOT))).toBe(true);
  });
});

describe("002_session_ownership.sql", () => {
  const sql = read("supabase/migrations/002_session_ownership.sql");

  it("adds nullable user_id to all 7 tables (non-breaking)", () => {
    for (const t of TABLES) {
      expect(sql).toContain(`ALTER TABLE ${t}`);
    }
    const adds = sql.match(/ADD COLUMN IF NOT EXISTS user_id UUID/g) ?? [];
    expect(adds.length).toBe(7);
  });

  it("removes the open USING(true) policies", () => {
    expect(sql).not.toMatch(/USING\s*\(\s*true\s*\)/);
    const drops = sql.match(/DROP POLICY IF EXISTS "Allow all for service role"/g) ?? [];
    expect(drops.length).toBe(7);
  });

  it("adds strict owner policies bound to auth.uid()", () => {
    const owners = sql.match(/CREATE POLICY "Owner full access"[\s\S]*?USING \(\(select auth\.uid\(\)\) = user_id\)[\s\S]*?WITH CHECK \(\(select auth\.uid\(\)\) = user_id\)/g) ?? [];
    expect(owners.length).toBe(7);
    expect(sql).toMatch(/FOR ALL TO authenticated/);
  });

  it("contains legacy anon access to unowned rows only", () => {
    const legacy = sql.match(/CREATE POLICY "Legacy anon unowned access"[\s\S]*?FOR ALL TO anon[\s\S]*?USING \(user_id IS NULL\)[\s\S]*?WITH CHECK \(user_id IS NULL\)/g) ?? [];
    expect(legacy.length).toBe(7);
  });

  it("adds owner indexes for all 7 tables", () => {
    for (const t of TABLES) {
      expect(sql).toContain(`idx_${t}_user_id`);
    }
  });
});

describe("003_per_operation_policies.sql", () => {
  const sql = read("supabase/migrations/003_per_operation_policies.sql");

  it("exists alongside history and never edits 0001/001/002", () => {
    expect(existsSync(new URL("supabase/migrations/003_per_operation_policies.sql", ROOT))).toBe(true);
    expect(sql).not.toMatch(/ALTER TABLE/);
    expect(sql).not.toMatch(/USING\s*\(\s*true\s*\)/);
  });

  it("drops the two FOR ALL policies per table (14 drops, idempotent)", () => {
    const ownerDrops = sql.match(/DROP POLICY IF EXISTS "Owner full access"/g) ?? [];
    const anonDrops = sql.match(/DROP POLICY IF EXISTS "Legacy anon unowned access"/g) ?? [];
    expect(ownerDrops.length).toBe(7);
    expect(anonDrops.length).toBe(7);
    // No executable FOR ALL policy remains (header/rollback comments may mention it).
    expect(sql).not.toMatch(/CREATE POLICY[^;]*?FOR ALL/);
  });

  it("creates 4 owner per-op policies per table with 002-identical predicates", () => {
    for (const op of ["select", "insert", "update", "delete"]) {
      const found = sql.match(new RegExp(`CREATE POLICY "Owner ${op}"`, "g")) ?? [];
      expect(found.length).toBe(7);
    }
    // SELECT/DELETE carry USING only; INSERT carries WITH CHECK only; UPDATE carries both.
    const ownerSelects = sql.match(/CREATE POLICY "Owner select"[\s\S]*?FOR SELECT TO authenticated[\s\S]*?USING \(\(select auth\.uid\(\)\) = user_id\)/g) ?? [];
    const ownerInserts = sql.match(/CREATE POLICY "Owner insert"[\s\S]*?FOR INSERT TO authenticated[\s\S]*?WITH CHECK \(\(select auth\.uid\(\)\) = user_id\)/g) ?? [];
    const ownerUpdates = sql.match(/CREATE POLICY "Owner update"[\s\S]*?FOR UPDATE TO authenticated[\s\S]*?USING \(\(select auth\.uid\(\)\) = user_id\)[\s\S]*?WITH CHECK \(\(select auth\.uid\(\)\) = user_id\)/g) ?? [];
    const ownerDeletes = sql.match(/CREATE POLICY "Owner delete"[\s\S]*?FOR DELETE TO authenticated[\s\S]*?USING \(\(select auth\.uid\(\)\) = user_id\)/g) ?? [];
    expect(ownerSelects.length).toBe(7);
    expect(ownerInserts.length).toBe(7);
    expect(ownerUpdates.length).toBe(7);
    expect(ownerDeletes.length).toBe(7);
  });

  it("creates 4 NULL-gated anon per-op policies per table (legacy bridge preserved)", () => {
    for (const op of ["select", "insert", "update", "delete"]) {
      const found = sql.match(new RegExp(`CREATE POLICY "Legacy anon ${op} unowned"`, "g")) ?? [];
      expect(found.length).toBe(7);
    }
    const anonSelects = sql.match(/CREATE POLICY "Legacy anon select unowned"[\s\S]*?FOR SELECT TO anon[\s\S]*?USING \(user_id IS NULL\)/g) ?? [];
    const anonInserts = sql.match(/CREATE POLICY "Legacy anon insert unowned"[\s\S]*?FOR INSERT TO anon[\s\S]*?WITH CHECK \(user_id IS NULL\)/g) ?? [];
    const anonUpdates = sql.match(/CREATE POLICY "Legacy anon update unowned"[\s\S]*?FOR UPDATE TO anon[\s\S]*?USING \(user_id IS NULL\)[\s\S]*?WITH CHECK \(user_id IS NULL\)/g) ?? [];
    const anonDeletes = sql.match(/CREATE POLICY "Legacy anon delete unowned"[\s\S]*?FOR DELETE TO anon[\s\S]*?USING \(user_id IS NULL\)/g) ?? [];
    expect(anonSelects.length).toBe(7);
    expect(anonInserts.length).toBe(7);
    expect(anonUpdates.length).toBe(7);
    expect(anonDeletes.length).toBe(7);
  });
});

// H2.1: 004 pins the additive-only discipline for evidence columns —
// nullable ADD COLUMNs, no policy surgery, no open predicates.
describe("004_practice_evidence.sql", () => {
  const sql = read("supabase/migrations/004_practice_evidence.sql");

  it("only adds nullable evidence/confidence columns to practice_sessions", () => {
    expect(sql).toMatch(/ADD COLUMN IF NOT EXISTS evidence/);
    expect(sql).toMatch(/ADD COLUMN IF NOT EXISTS confidence/);
    expect(sql).not.toMatch(/DROP POLICY/);
    expect(sql).not.toMatch(/CREATE POLICY/);
    expect(sql).not.toMatch(/USING\s*\(\s*true\s*\)/);
  });

  it("keeps history renderable (defaults preserve score-only rows)", () => {
    expect(sql).toMatch(/DEFAULT '\{\}'/);
    expect(sql).toMatch(/DEFAULT 'medium'/);
  });
});
