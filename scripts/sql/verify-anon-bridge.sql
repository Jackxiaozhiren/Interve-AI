-- ============================================================================
-- verify-anon-bridge.sql — the one paste that closes PAIN-#5
-- ============================================================================
-- Why this file exists: docs/SECURITY.md asserts that migration 006 closed the
-- legacy anon bridge on the content tables, while 006's own header says
-- "STATUS: DRAFT — NOT APPLIED ANYWHERE". Both are in the repo at once, and no
-- keyless local path can reach the live catalog to settle it: the publishable
-- (NEXT_PUBLIC) key reads through PostgREST, which applies RLS but never
-- reports it. Measured 2026-10-07, all seven content tables return HTTP 200 with
-- zero rows to anon — which is consistent both with the bridge being closed and
-- with the project simply holding no ownerless rows. That ambiguity is the whole
-- open item.
--
-- Run this in the Supabase dashboard's SQL editor against project
-- bfgglzjltfvfpobzscet (the production project the app points at). Read-only:
-- one SELECT over a catalog view, no DDL, no data access, $0.
--
-- Then put the result into docs/audit/anon-bridge-evidence.json — set
-- "status": "PROVEN", "collectedAt" to today, "source" to the project ref, and
-- paste each row as {"table": ..., "policy": ...} — and run:
--
--     npm run test:unit -- anon-bridge-status
--
-- tests/unit/anon-bridge-status.test.ts then checks the dump against the policy
-- set derived from supabase/migrations/*.sql by scripts/derive-policy-state.mjs.
-- It does not trust the prose, and it does not trust an empty result: a dump
-- that lists fewer policies than the migrations define, or that drops the bridge
-- on telemetry/achievements (which 006 deliberately keeps), is red.
-- ============================================================================

SELECT
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

-- Expected: 36 rows.
--   28 of them are the four per-operation owner policies on each of the seven
--   tables (Owner select | Owner insert | Owner update | Owner delete, each
--   USING ((SELECT auth.uid()) = user_id), TO authenticated).
--   8 are the bridge kept on purpose: Legacy anon {select,insert,update,delete}
--   unowned on telemetry and on achievements (USING (user_id IS NULL), TO anon).
--
-- The discriminator is the missing half: those same four policy names must NOT
-- appear on interviews, evaluations, practice_sessions, assessments or
-- orama_index. If they do, 006 was never applied and every holder of the
-- publishable key can read every ownerless content row.
--
-- Optional second paste, to make the 0-row probe informative rather than
-- ambiguous — it answers "does ownerless content even exist?":
--
--   SELECT count(*) FROM interviews      WHERE user_id IS NULL;
--   SELECT count(*) FROM evaluations     WHERE user_id IS NULL;
--   SELECT count(*) FROM practice_sessions WHERE user_id IS NULL;
--   SELECT count(*) FROM assessments     WHERE user_id IS NULL;
--   SELECT count(*) FROM orama_index     WHERE user_id IS NULL;
--
-- If all five are 0, an anon read returning [] proves nothing about the policy,
-- and only the pg_policies dump above settles it.
