-- ============================================================
-- Interve AI migration 002: session ownership foundation
-- Phase 2 (Stabilization). ADDITIVE ONLY — never edits 0001/001.
--
-- Intent:
--   1. Add nullable `user_id UUID` to all 7 user-data tables so a future
--      Supabase Auth cutover can bind every row to `auth.uid()`.
--   2. Replace the over-permissive allow-all policies with:
--        a. strict owner policies for the `authenticated` role
--           (`auth.uid() = user_id`), active after the Auth cutover;
--        b. contained legacy policies for `anon` limited to unowned rows
--           (`user_id IS NULL`), so the demo keeps working while owned
--           rows become invisible/untouchable to anonymous clients.
--   3. Add covering indexes for the coming owner-scoped queries.
--
-- Non-breaking: all columns nullable, all statements idempotent
-- (IF NOT EXISTS / DROP IF EXISTS). Existing rows keep working.
--
-- Rollback (run manually, in order):
--   DROP POLICY IF EXISTS "Owner full access" ON <table>;            -- x7
--   DROP POLICY IF EXISTS "Legacy anon unowned access" ON <table>;   -- x7
--   DROP INDEX IF EXISTS idx_<table>_user_id;                         -- x7
--   ALTER TABLE <table> DROP COLUMN IF EXISTS user_id;                -- x7
--   -- then re-apply the 001 policies if a full revert is required.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Ownership columns (nullable: legacy rows stay NULL = unowned)
-- ------------------------------------------------------------
ALTER TABLE interviews        ADD COLUMN IF NOT EXISTS user_id UUID;
ALTER TABLE evaluations       ADD COLUMN IF NOT EXISTS user_id UUID;
ALTER TABLE practice_sessions ADD COLUMN IF NOT EXISTS user_id UUID;
ALTER TABLE telemetry         ADD COLUMN IF NOT EXISTS user_id UUID;
ALTER TABLE achievements      ADD COLUMN IF NOT EXISTS user_id UUID;
ALTER TABLE orama_index       ADD COLUMN IF NOT EXISTS user_id UUID;
ALTER TABLE assessments       ADD COLUMN IF NOT EXISTS user_id UUID;

-- ------------------------------------------------------------
-- 2. Covering indexes for owner-scoped queries
-- ------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_interviews_user_id        ON interviews (user_id);
CREATE INDEX IF NOT EXISTS idx_evaluations_user_id       ON evaluations (user_id);
CREATE INDEX IF NOT EXISTS idx_practice_sessions_user_id ON practice_sessions (user_id);
CREATE INDEX IF NOT EXISTS idx_telemetry_user_id         ON telemetry (user_id);
CREATE INDEX IF NOT EXISTS idx_achievements_user_id      ON achievements (user_id);
CREATE INDEX IF NOT EXISTS idx_orama_index_user_id       ON orama_index (user_id);
CREATE INDEX IF NOT EXISTS idx_assessments_user_id       ON assessments (user_id);

-- ------------------------------------------------------------
-- 3. Replace open policies with owner + legacy-contained policies
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "Allow all for service role" ON interviews;
DROP POLICY IF EXISTS "Allow all for service role" ON evaluations;
DROP POLICY IF EXISTS "Allow all for service role" ON practice_sessions;
DROP POLICY IF EXISTS "Allow all for service role" ON telemetry;
DROP POLICY IF EXISTS "Allow all for service role" ON achievements;
DROP POLICY IF EXISTS "Allow all for service role" ON orama_index;
DROP POLICY IF EXISTS "Allow all for service role" ON assessments;

-- 3a. Strict owner policies (enforced once Supabase Auth issues JWTs).
CREATE POLICY "Owner full access" ON interviews
  FOR ALL TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "Owner full access" ON evaluations
  FOR ALL TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "Owner full access" ON practice_sessions
  FOR ALL TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "Owner full access" ON telemetry
  FOR ALL TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "Owner full access" ON achievements
  FOR ALL TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "Owner full access" ON orama_index
  FOR ALL TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "Owner full access" ON assessments
  FOR ALL TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

-- 3b. Legacy containment: anonymous clients keep working ONLY on rows
-- that have no owner yet. Owned rows are invisible to anon.
CREATE POLICY "Legacy anon unowned access" ON interviews
  FOR ALL TO anon
  USING (user_id IS NULL)
  WITH CHECK (user_id IS NULL);

CREATE POLICY "Legacy anon unowned access" ON evaluations
  FOR ALL TO anon
  USING (user_id IS NULL)
  WITH CHECK (user_id IS NULL);

CREATE POLICY "Legacy anon unowned access" ON practice_sessions
  FOR ALL TO anon
  USING (user_id IS NULL)
  WITH CHECK (user_id IS NULL);

CREATE POLICY "Legacy anon unowned access" ON telemetry
  FOR ALL TO anon
  USING (user_id IS NULL)
  WITH CHECK (user_id IS NULL);

CREATE POLICY "Legacy anon unowned access" ON achievements
  FOR ALL TO anon
  USING (user_id IS NULL)
  WITH CHECK (user_id IS NULL);

CREATE POLICY "Legacy anon unowned access" ON orama_index
  FOR ALL TO anon
  USING (user_id IS NULL)
  WITH CHECK (user_id IS NULL);

CREATE POLICY "Legacy anon unowned access" ON assessments
  FOR ALL TO anon
  USING (user_id IS NULL)
  WITH CHECK (user_id IS NULL);
