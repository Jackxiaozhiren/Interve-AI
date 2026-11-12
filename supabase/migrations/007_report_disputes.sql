-- ============================================================================
-- Migration 007: let the candidate record an objection against a dimension
-- VERSION: 7.0 | DATE: 2026-11-12 | STATUS: PENDING — apply in the Supabase
--          SQL Editor BEFORE the code that writes this column is merged.
-- ============================================================================
-- Severity: high (the writer fails closed, but only after this exists)
-- Depends on: 001 (interviews), 005 (evaluation_v2 — the reason this file's
--             ordering matters), 002/003 (ownership)
--
-- WHY A COLUMN AND NOT A TABLE
-- An objection is one immutable sentence about one dimension of one report:
-- {dimensionId, reason, note, createdAt}. It is always read with the report
-- and never queried across candidates, so a table would add a join and a
-- second RLS surface for no benefit. A JSONB array keeps it in the row that
-- the candidate already owns, and the existing owner predicate therefore
-- already governs it — no new grant, no new policy, nothing to get wrong at
-- the anon bridge.
--
-- WHY THE ORDER IS THE WHOLE POINT
-- 005 exists because `toSnakeCase` forwards every key of the Interview object
-- to PostgREST with no column whitelist: an unknown key fails the WHOLE
-- INSERT/UPDATE with Postgres 42703 (undefined_column). The symptom points at
-- the network, not the schema, and it took a live catalog probe to find. That
-- is why this file is PENDING rather than shipped alongside its writer: until
-- the column exists in the project, any client that sends `reportDisputes`
-- takes down its own update — including the settlement write that saves the
-- interview.
--
-- WHAT IT DOES NOT DO
-- It stores the objection; it does not resolve it. Routing to a calibration
-- queue is a human process, and the product statement to the candidate is
-- "you can record this and a person will look", not "this was adjudicated".
--
-- ROLLBACK
--   ALTER TABLE interviews DROP COLUMN IF EXISTS report_disputes;
-- Dropping loses objections and nothing else; no product read path depends on
-- the column being non-empty.
-- ============================================================================

ALTER TABLE interviews
  ADD COLUMN IF NOT EXISTS report_disputes JSONB NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN interviews.report_disputes IS
  'Candidate objections to scored dimensions: [{dimensionId, reason, note, createdAt}]. Append-only from the client; read with the report.';
