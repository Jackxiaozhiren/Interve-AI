-- ============================================================================
-- Migration 009: same-track benchmarks (Phase 4 / issue #194, option A)
-- VERSION: 9.0 | DATE: 2026-11-13 | STATUS: PENDING — apply before the reader ships.
-- ============================================================================
-- Severity: high (a caller-controlled threshold turns an aggregate into a row)
-- Depends on: 001 (interviews), 005 (evaluation_v2), 002/003 (ownership)
--
-- WHAT "COHORT" MEANS HERE
-- The owner chose option A on 2026-11-13: a cohort is the SAME TRACK — the same
-- `interview_type` (role direction) and the same `rubric_id` (scoring rubric) —
-- over a rolling 180 days. No school, employer or any other identity attribute
-- is collected, so there is nothing new to consent to. This is deliberately
-- narrower than "institution": a future institutional view needs an identity
-- field and a privacy story first, and that is issue #194's remaining half.
--
-- WHY THE THRESHOLD IS NOT A PARAMETER
-- The obvious signature takes `p_min_cell` and lets the UI decide. That is the
-- bug: any caller could pass 1 and read a "distribution" of one person, which
-- is a row, not a distribution. The floor is therefore a constant in this file
-- (10), and the function has no argument that can lower it.
--
-- WHY THE WINDOW IS NOT A PARAMETER EITHER
-- `p_days` would let a caller widen the sample until a small cell passes the
-- floor — a slow version of the same attack. 180 days is fixed here.
--
-- WHAT IT RETURNS, AND WHAT IT CANNOT
-- One row per dimension with n, p25, p50, p75 over the rubric's 1-5 score.
-- There is no per-interview row, no id, no timestamp, no free text: the
-- JSON aggregation below never selects a row's own columns beyond the two that
-- define the cohort.
--
-- ACCESS
-- `authenticated` only. Anonymous callers get nothing: a public benchmark
-- endpoint would let anyone probe which tracks exist and how large they are.
--
-- ROLLBACK
--   DROP FUNCTION IF EXISTS public.cohort_benchmarks(text, text);
-- ============================================================================

CREATE OR REPLACE FUNCTION public.cohort_benchmarks(
  p_interview_type text,
  p_rubric_id text
)
RETURNS TABLE (
  dimension_id text,
  n integer,
  p25 numeric,
  p50 numeric,
  p75 numeric
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  WITH scored AS (
    SELECT
      d->>'id'                 AS dimension_id,
      (d->>'score')::numeric   AS score
    FROM public.interviews i
    CROSS JOIN LATERAL jsonb_array_elements(i.evaluation_v2->'dimensions') AS d
    WHERE i.status = 'completed'
      AND i.evaluation_v2 IS NOT NULL
      AND i.evaluation_v2->>'rubricId' = p_rubric_id
      AND coalesce(i.interview_type, '') = coalesce(p_interview_type, '')
      AND i.created_at >= now() - interval '180 days'
      AND (d->>'score') ~ '^[0-9]+(\.[0-9]+)?$'
  )
  SELECT
    dimension_id,
    count(*)::integer                                   AS n,
    percentile_cont(0.25) WITHIN GROUP (ORDER BY score)  AS p25,
    percentile_cont(0.50) WITHIN GROUP (ORDER BY score)  AS p50,
    percentile_cont(0.75) WITHIN GROUP (ORDER BY score)  AS p75
  FROM scored
  GROUP BY dimension_id
  HAVING count(*) >= 10
  ORDER BY dimension_id;
$$;

REVOKE ALL ON FUNCTION public.cohort_benchmarks(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cohort_benchmarks(text, text) TO authenticated;

COMMENT ON FUNCTION public.cohort_benchmarks(text, text) IS
  'Same-track rubric score distribution (n, p25, p50, p75) with a hard floor of 10 reports per dimension over a fixed 180-day window. No identity attributes, no per-row output.';
