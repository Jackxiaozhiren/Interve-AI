-- ============================================================
-- Interve AI migration 003: per-operation RLS policies
-- Phase 2 (Stabilization, 2026-09-14). ADDITIVE ONLY — never edits
-- 0001/001/002.
--
-- Intent:
--   Split the two FOR ALL policies per table (from 002) into
--   per-operation policies (SELECT / INSERT / UPDATE / DELETE) with
--   IDENTICAL predicates. Zero behavior change; the split follows the
--   Supabase official guidance (one policy per operation, see
--   docs/research/TECH_RESEARCH.md §A #3 and §C #21) so future
--   least-privilege edits (e.g. anon SELECT-only, no anon writes) can
--   land without touching owner write paths.
--
--   Predicate parity with 002 (verified by
--   tests/integration/rls-policies.test.ts):
--     owner: ((select auth.uid()) = user_id)  TO authenticated
--     anon:  (user_id IS NULL)                TO anon (legacy bridge)
--
-- Non-breaking: DROP IF EXISTS + CREATE; safe to run whether or not
-- 002 was applied (drops become no-ops). Existing rows unaffected.
--
-- Rollback (run manually, in order):
--   DROP POLICY IF EXISTS "Owner select" ON <table>;              -- x7
--   DROP POLICY IF EXISTS "Owner insert" ON <table>;              -- x7
--   DROP POLICY IF EXISTS "Owner update" ON <table>;              -- x7
--   DROP POLICY IF EXISTS "Owner delete" ON <table>;              -- x7
--   DROP POLICY IF EXISTS "Legacy anon select unowned" ON <table>;-- x7
--   DROP POLICY IF EXISTS "Legacy anon insert unowned" ON <table>;-- x7
--   DROP POLICY IF EXISTS "Legacy anon update unowned" ON <table>;-- x7
--   DROP POLICY IF EXISTS "Legacy anon delete unowned" ON <table>;-- x7
--   -- then re-run 002 §3 to restore the FOR ALL policies.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Drop the FOR ALL policies from 002 (no-op if 002 absent)
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "Owner full access" ON interviews;
DROP POLICY IF EXISTS "Owner full access" ON evaluations;
DROP POLICY IF EXISTS "Owner full access" ON practice_sessions;
DROP POLICY IF EXISTS "Owner full access" ON telemetry;
DROP POLICY IF EXISTS "Owner full access" ON achievements;
DROP POLICY IF EXISTS "Owner full access" ON orama_index;
DROP POLICY IF EXISTS "Owner full access" ON assessments;

DROP POLICY IF EXISTS "Legacy anon unowned access" ON interviews;
DROP POLICY IF EXISTS "Legacy anon unowned access" ON evaluations;
DROP POLICY IF EXISTS "Legacy anon unowned access" ON practice_sessions;
DROP POLICY IF EXISTS "Legacy anon unowned access" ON telemetry;
DROP POLICY IF EXISTS "Legacy anon unowned access" ON achievements;
DROP POLICY IF EXISTS "Legacy anon unowned access" ON orama_index;
DROP POLICY IF EXISTS "Legacy anon unowned access" ON assessments;

-- ------------------------------------------------------------
-- 2. Owner per-operation policies (TO authenticated)
--    Same predicate as 002 "Owner full access", split by operation.
-- ------------------------------------------------------------

-- interviews
CREATE POLICY "Owner select" ON interviews
  FOR SELECT TO authenticated
  USING ((select auth.uid()) = user_id);
CREATE POLICY "Owner insert" ON interviews
  FOR INSERT TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);
CREATE POLICY "Owner update" ON interviews
  FOR UPDATE TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);
CREATE POLICY "Owner delete" ON interviews
  FOR DELETE TO authenticated
  USING ((select auth.uid()) = user_id);

-- evaluations
CREATE POLICY "Owner select" ON evaluations
  FOR SELECT TO authenticated
  USING ((select auth.uid()) = user_id);
CREATE POLICY "Owner insert" ON evaluations
  FOR INSERT TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);
CREATE POLICY "Owner update" ON evaluations
  FOR UPDATE TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);
CREATE POLICY "Owner delete" ON evaluations
  FOR DELETE TO authenticated
  USING ((select auth.uid()) = user_id);

-- practice_sessions
CREATE POLICY "Owner select" ON practice_sessions
  FOR SELECT TO authenticated
  USING ((select auth.uid()) = user_id);
CREATE POLICY "Owner insert" ON practice_sessions
  FOR INSERT TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);
CREATE POLICY "Owner update" ON practice_sessions
  FOR UPDATE TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);
CREATE POLICY "Owner delete" ON practice_sessions
  FOR DELETE TO authenticated
  USING ((select auth.uid()) = user_id);

-- telemetry
CREATE POLICY "Owner select" ON telemetry
  FOR SELECT TO authenticated
  USING ((select auth.uid()) = user_id);
CREATE POLICY "Owner insert" ON telemetry
  FOR INSERT TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);
CREATE POLICY "Owner update" ON telemetry
  FOR UPDATE TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);
CREATE POLICY "Owner delete" ON telemetry
  FOR DELETE TO authenticated
  USING ((select auth.uid()) = user_id);

-- achievements
CREATE POLICY "Owner select" ON achievements
  FOR SELECT TO authenticated
  USING ((select auth.uid()) = user_id);
CREATE POLICY "Owner insert" ON achievements
  FOR INSERT TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);
CREATE POLICY "Owner update" ON achievements
  FOR UPDATE TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);
CREATE POLICY "Owner delete" ON achievements
  FOR DELETE TO authenticated
  USING ((select auth.uid()) = user_id);

-- orama_index
CREATE POLICY "Owner select" ON orama_index
  FOR SELECT TO authenticated
  USING ((select auth.uid()) = user_id);
CREATE POLICY "Owner insert" ON orama_index
  FOR INSERT TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);
CREATE POLICY "Owner update" ON orama_index
  FOR UPDATE TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);
CREATE POLICY "Owner delete" ON orama_index
  FOR DELETE TO authenticated
  USING ((select auth.uid()) = user_id);

-- assessments
CREATE POLICY "Owner select" ON assessments
  FOR SELECT TO authenticated
  USING ((select auth.uid()) = user_id);
CREATE POLICY "Owner insert" ON assessments
  FOR INSERT TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);
CREATE POLICY "Owner update" ON assessments
  FOR UPDATE TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);
CREATE POLICY "Owner delete" ON assessments
  FOR DELETE TO authenticated
  USING ((select auth.uid()) = user_id);

-- ------------------------------------------------------------
-- 3. Legacy anon per-operation policies (TO anon, NULL-gated)
--    Same predicate as 002 "Legacy anon unowned access", split by
--    operation. Owned rows stay invisible to anon. This bridge is
--    removed at the Supabase Auth cutover (tracked, not hidden).
-- ------------------------------------------------------------

-- interviews
CREATE POLICY "Legacy anon select unowned" ON interviews
  FOR SELECT TO anon
  USING (user_id IS NULL);
CREATE POLICY "Legacy anon insert unowned" ON interviews
  FOR INSERT TO anon
  WITH CHECK (user_id IS NULL);
CREATE POLICY "Legacy anon update unowned" ON interviews
  FOR UPDATE TO anon
  USING (user_id IS NULL)
  WITH CHECK (user_id IS NULL);
CREATE POLICY "Legacy anon delete unowned" ON interviews
  FOR DELETE TO anon
  USING (user_id IS NULL);

-- evaluations
CREATE POLICY "Legacy anon select unowned" ON evaluations
  FOR SELECT TO anon
  USING (user_id IS NULL);
CREATE POLICY "Legacy anon insert unowned" ON evaluations
  FOR INSERT TO anon
  WITH CHECK (user_id IS NULL);
CREATE POLICY "Legacy anon update unowned" ON evaluations
  FOR UPDATE TO anon
  USING (user_id IS NULL)
  WITH CHECK (user_id IS NULL);
CREATE POLICY "Legacy anon delete unowned" ON evaluations
  FOR DELETE TO anon
  USING (user_id IS NULL);

-- practice_sessions
CREATE POLICY "Legacy anon select unowned" ON practice_sessions
  FOR SELECT TO anon
  USING (user_id IS NULL);
CREATE POLICY "Legacy anon insert unowned" ON practice_sessions
  FOR INSERT TO anon
  WITH CHECK (user_id IS NULL);
CREATE POLICY "Legacy anon update unowned" ON practice_sessions
  FOR UPDATE TO anon
  USING (user_id IS NULL)
  WITH CHECK (user_id IS NULL);
CREATE POLICY "Legacy anon delete unowned" ON practice_sessions
  FOR DELETE TO anon
  USING (user_id IS NULL);

-- telemetry
CREATE POLICY "Legacy anon select unowned" ON telemetry
  FOR SELECT TO anon
  USING (user_id IS NULL);
CREATE POLICY "Legacy anon insert unowned" ON telemetry
  FOR INSERT TO anon
  WITH CHECK (user_id IS NULL);
CREATE POLICY "Legacy anon update unowned" ON telemetry
  FOR UPDATE TO anon
  USING (user_id IS NULL)
  WITH CHECK (user_id IS NULL);
CREATE POLICY "Legacy anon delete unowned" ON telemetry
  FOR DELETE TO anon
  USING (user_id IS NULL);

-- achievements
CREATE POLICY "Legacy anon select unowned" ON achievements
  FOR SELECT TO anon
  USING (user_id IS NULL);
CREATE POLICY "Legacy anon insert unowned" ON achievements
  FOR INSERT TO anon
  WITH CHECK (user_id IS NULL);
CREATE POLICY "Legacy anon update unowned" ON achievements
  FOR UPDATE TO anon
  USING (user_id IS NULL)
  WITH CHECK (user_id IS NULL);
CREATE POLICY "Legacy anon delete unowned" ON achievements
  FOR DELETE TO anon
  USING (user_id IS NULL);

-- orama_index
CREATE POLICY "Legacy anon select unowned" ON orama_index
  FOR SELECT TO anon
  USING (user_id IS NULL);
CREATE POLICY "Legacy anon insert unowned" ON orama_index
  FOR INSERT TO anon
  WITH CHECK (user_id IS NULL);
CREATE POLICY "Legacy anon update unowned" ON orama_index
  FOR UPDATE TO anon
  USING (user_id IS NULL)
  WITH CHECK (user_id IS NULL);
CREATE POLICY "Legacy anon delete unowned" ON orama_index
  FOR DELETE TO anon
  USING (user_id IS NULL);

-- assessments
CREATE POLICY "Legacy anon select unowned" ON assessments
  FOR SELECT TO anon
  USING (user_id IS NULL);
CREATE POLICY "Legacy anon insert unowned" ON assessments
  FOR INSERT TO anon
  WITH CHECK (user_id IS NULL);
CREATE POLICY "Legacy anon update unowned" ON assessments
  FOR UPDATE TO anon
  USING (user_id IS NULL)
  WITH CHECK (user_id IS NULL);
CREATE POLICY "Legacy anon delete unowned" ON assessments
  FOR DELETE TO anon
  USING (user_id IS NULL);
