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
-- Then put the result into docs/audit/anon-bridge-evidence.json: "collectedAt" to the day, each
-- row as {"table", "policy", "permissive", "roles", "cmd", "qual"} (roles and qual are what the
-- gate reads — a name is not enough to classify a grant), and "status" to "PROVEN" only if no
-- returned row has roles including anon on a content table, otherwise "OPEN". Then run:
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

-- ANSWER, measured 2026-10-12 by this exact SELECT: 14 rows, seven tables, two
-- policies per table. `Legacy anon unowned access` FOR ALL TO anon USING
-- (user_id IS NULL) is live on all five content tables, so 006 has not been
-- applied. The comment below is what the repo *believed* before the catalog was
-- read; it is kept so the difference between the migrations and the deployment
-- stays legible, and the dump in docs/audit/anon-bridge-evidence.json is the
-- thing the gate now compares against.
--
-- Believed expectation: 36 rows.
--   28 of them are the four per-operation owner policies on each of the seven
--   tables (Owner select | Owner insert | Owner update | Owner delete, each
--   USING ((SELECT auth.uid()) = user_id), TO authenticated).
--   8 are the bridge kept on purpose: Legacy anon {select,insert,update,delete}
--   unowned on telemetry and on achievements (USING (user_id IS NULL), TO anon).
--   Production has none of these names. It has one owner policy and one anon
--   policy per table, both `cmd = ALL`.
--
-- The discriminator is the missing half: no policy with roles including `anon`
-- may remain on interviews, evaluations, practice_sessions, assessments or
-- orama_index. Keyed on names it looked closed; keyed on the grant it is not —
-- which is why 006 drops by predicate as of 2026-10-12.
--
-- Closure check, the one that must return 0 rows when the owner has applied the
-- corrected 006:
--
--   SELECT tablename, policyname FROM pg_policies
--   WHERE schemaname = 'public'
--     AND tablename IN ('interviews','evaluations','practice_sessions','assessments','orama_index')
--     AND roles @> ARRAY['anon']::text[]
--   ORDER BY tablename, policyname;
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
