-- ============================================================
-- Interve AI — Supabase Database Migration
-- Version: 004_practice_evidence
-- Description: Persists the practice evidence envelope (§9) per attempt.
--              Additive + nullable: old rows without grounding keep
--              rendering score-only (history preserved, never rewritten).
--
-- USAGE: same as 001_init_schema.sql (SQL Editor → Run).
-- ============================================================

ALTER TABLE IF EXISTS practice_sessions
  ADD COLUMN IF NOT EXISTS evidence TEXT[] DEFAULT '{}';

ALTER TABLE IF EXISTS practice_sessions
  ADD COLUMN IF NOT EXISTS confidence TEXT DEFAULT 'medium'
    CHECK (confidence IN ('high', 'medium', 'low'));
