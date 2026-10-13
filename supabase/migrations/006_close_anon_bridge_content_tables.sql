-- ============================================================================
-- Migration 006: close the legacy anon bridge on user-content tables
-- VERSION: 6.1 | DATE: 2026-10-12 | STATUS: DRAFT — CONFIRMED NOT APPLIED
-- ============================================================================
-- "Confirmed", not "asserted": the pg_policies dump in
-- docs/audit/anon-bridge-evidence.json (read 2026-10-12 from project
-- bfgglzjltfvfpobzscet) shows one policy per table, `Legacy anon unowned access`
-- FOR ALL TO anon USING (user_id IS NULL), on all seven tables. If this file had
-- been applied, five of those seven rows would not exist. The same dump is why
-- step 1 below is no longer the whole migration.
-- Severity: P0 | Owner: full-stack | Depends on: 002, 003, and the OAuth-primary
-- decision recorded in supabase/migrations/README.md
--
-- INTENT
-- The bridge is the set of anon policies gated on `user_id IS NULL` that let the
-- pre-auth demo identity keep using the database while the app had no real
-- accounts. 003 wrote it as four per-operation policies per table; the project
-- this file is meant for has it as a single `cmd = ALL` policy per table under a
-- different name. Both shapes are the same hole, and a migration that only knows
-- one of the two names closes neither. 003's own header says the bridge is
-- temporary: "This bridge is removed at the Supabase Auth cutover (tracked, not
-- hidden)." This file is that removal, scoped to the tables that hold candidate
-- content.
--
-- WHY IT IS NOT MERELY HYPOTHETICAL
-- The browser client is createClient(url, anonKey) (src/lib/supabase.ts) and
-- nothing in src/ calls auth.setSession, so every request is Postgres role
-- `anon` until an OAuth session exists. Two consequences, both measured:
--   * Reads: dashboard/page.tsx:47 issues
--     db.interviews.orderBy('createdAt').reverse().toArray(), and the wrapper at
--     src/lib/api-client.ts:138+ sends select('*') with NO user predicate. The
--     only thing narrowing it is RLS. Under the bridge that means every holder of
--     the publishable key reads every NULL-owned row: other candidates' resume
--     text, job descriptions and full transcripts.
--   * Writes: stampOwner() now refuses ownerless writes to these tables, so no
--     NEW NULL-owned content row can be created by this app. It says nothing
--     about rows that already exist, and it does nothing for the read path
--     above, which is why the policy has to go as well.
--
-- SCOPE: LIVE GRANTS ON THIS PROJECT: 5 -- one "Legacy anon unowned access"
--   FOR ALL TO anon USING (user_id IS NULL) grant per closed table, read out of
--   pg_policies into docs/audit/anon-bridge-evidence.json on 2026-10-12.
--   tests/unit/anon-bridge-status.test.ts re-derives that number from the dump
--   and fails if this digit and the dump disagree, or if the dump stops being
--   one grant per table -- either way the sentence above has to be re-read, not
--   re-typed. Step 1 is NOT the scope: it drops the 20 per-operation names 003
--   defines for a four-operation shape, and on this project all 20 match nothing.
-- DELIBERATELY NOT CLOSED: telemetry and achievements keep their bridge.
--   telemetry is PII-free by the observability section's own rules and
--   tests/unit/owner-binding.test.ts still pins unowned telemetry writes;
--   achievements writes are not owner-gated, so dropping their policy here would
--   turn a working feature into a silent failure. Revisit both when they are
--   owner-gated, not before.
--
-- ROLLBACK (re-creates exactly what 003 defines; 003 is idempotent for these)
--   -- interviews
--   CREATE POLICY "Legacy anon select unowned" ON interviews FOR SELECT TO anon USING (user_id IS NULL);
--   CREATE POLICY "Legacy anon insert unowned" ON interviews FOR INSERT TO anon WITH CHECK (user_id IS NULL);
--   CREATE POLICY "Legacy anon update unowned" ON interviews FOR UPDATE TO anon USING (user_id IS NULL) WITH CHECK (user_id IS NULL);
--   CREATE POLICY "Legacy anon delete unowned" ON interviews FOR DELETE TO anon USING (user_id IS NULL);
--   -- and the same four for evaluations, practice_sessions, assessments, orama_index
-- Rollback is data-safe: policies are metadata, no rows are touched.
--
-- ORDERING CONSTRAINT — DO NOT RUN THIS BEFORE THE APP CAN AUTHENTICATE
-- Applying 006 while users still sign in through the email/password demo path
-- locks them out of all data access (they would be anon with no matching
-- policy). That is fail-closed, not dangerous, but it is a visible outage of
-- history/report/replay for those accounts. Land the OAuth path first — providers
-- are already enabled and the redirect allowlist already covers the production
-- domain, so what remains is the client-side change, not platform setup.
-- Then verify with the checks at the bottom before promoting.
-- ============================================================================

DO $$
DECLARE
  t TEXT;
  rec RECORD;
  remaining INT;
BEGIN
  -- 1. The per-operation names 003 introduced, kept for any project where that
  --    migration actually ran.
  FOREACH t IN ARRAY ARRAY['interviews', 'evaluations', 'practice_sessions', 'assessments', 'orama_index']
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', 'Legacy anon select unowned', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', 'Legacy anon insert unowned', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', 'Legacy anon update unowned', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', 'Legacy anon delete unowned', t);
  END LOOP;

  -- 2. Any anon policy that still grants access to ownerless rows on those
  --    tables, whatever it is called. This step was added on 2026-10-12 because
  --    step 1 alone cannot close the bridge that is actually deployed: project
  --    bfgglzjltfvfpobzscet has one policy per table named
  --    "Legacy anon unowned access" with cmd = ALL (see
  --    docs/audit/anon-bridge-evidence.json). Applying this file before step 2
  --    existed would have dropped four names that are not there, returned
  --    "success", and left all five content tables readable and writable by
  --    anyone holding the publishable key. Detection is a predicate, not a name.
  FOR rec IN
    SELECT policyname, tablename
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN ('interviews', 'evaluations', 'practice_sessions', 'assessments', 'orama_index')
      AND roles @> ARRAY['anon']::text[]
      AND qual LIKE '%user_id IS NULL%'
  LOOP
    EXECUTE format('DROP POLICY %I ON %I', rec.policyname, rec.tablename);
  END LOOP;

  -- 3. Refuse to report success while the hole is still open. Without this, a
  --    third naming drift would again "apply cleanly" and the documentation
  --    would again be wrong.
  SELECT count(*) INTO remaining
  FROM pg_policies
  WHERE schemaname = 'public'
    AND tablename IN ('interviews', 'evaluations', 'practice_sessions', 'assessments', 'orama_index')
    AND roles @> ARRAY['anon']::text[];
  IF remaining > 0 THEN
    RAISE EXCEPTION '006 removed the named bridge, but % anon-facing grant remains on the content tables', remaining
      USING HINT = 'add its name to step 1 or widen step 2; do not let this migration pass with the predicate unmet';
  END IF;
END
$$;

-- VERIFICATION, all read-only and $0. Sign in through OAuth first, then:
--   1. The bridge is gone — as anon this must now return 200 with [] rather
--      than leaking rows:
--        GET {SUPABASE_URL}/rest/v1/interviews?select=id&limit=5
--   2. As a signed-in account, your own rows are visible and mine are not:
--        GET {SUPABASE_URL}/rest/v1/interviews?select=id,user_id&limit=5
--      must return only rows whose user_id equals your auth uid.
--   3. Two accounts, same project: neither may see the other's row ids. This is
--      the checklist's "live dual-user RLS denial" item, and 006 is what makes it
--      testable at all — through the demo path it is inert by construction.
--   4. orama_index: an anon resume build must degrade to memory-only rather than
--      error (src/lib/orama-client.ts:114 already catches).
