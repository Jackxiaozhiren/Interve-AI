-- ============================================================
-- Interve AI — Supabase Database Migration
-- Version: 1.0.0
-- Description: Creates all required tables for the Interve AI
--              production environment.
-- 
-- USAGE:
--   1. Open your Supabase project dashboard
--   2. Navigate to SQL Editor
--   3. Paste this entire script and click "Run"
-- ============================================================

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- 1. INTERVIEWS TABLE
-- Core table storing all interview sessions with AI analysis
-- ============================================================
CREATE TABLE IF NOT EXISTS interviews (
  id              BIGSERIAL PRIMARY KEY,
  title           TEXT,
  job_description TEXT,
  resume_text     TEXT,
  include_coding  BOOLEAN DEFAULT FALSE,
  problem_statement TEXT,
  cheatsheet      TEXT[],
  stress_test     BOOLEAN DEFAULT FALSE,
  top_predictions JSONB DEFAULT '[]'::jsonb,
  status          TEXT NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'in_progress', 'completed')),
  radar_scores    JSONB,
  qa_review       JSONB DEFAULT '[]'::jsonb,
  delivery_stats  JSONB,
  hire_verdict    TEXT CHECK (hire_verdict IN (
                    'strong_hire', 'hire', 'leaning_hire',
                    'leaning_no_hire', 'no_hire'
                  )),
  verdict_rationale TEXT,
  council_debate  JSONB,
  timeline_events JSONB DEFAULT '[]'::jsonb,
  match_data      JSONB,
  cultural_traits JSONB DEFAULT '[]'::jsonb,
  training_roadmap JSONB,
  transcript      JSONB DEFAULT '[]'::jsonb,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_interviews_status ON interviews(status);
CREATE INDEX IF NOT EXISTS idx_interviews_created_at ON interviews(created_at DESC);

-- ============================================================
-- 2. EVALUATIONS TABLE
-- Recruiter-side candidate evaluations with tags and notes
-- ============================================================
CREATE TABLE IF NOT EXISTS evaluations (
  id            BIGSERIAL PRIMARY KEY,
  candidate_id  TEXT NOT NULL,
  notes         TEXT DEFAULT '',
  tags          TEXT[] DEFAULT '{}',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_evaluations_candidate ON evaluations(candidate_id);

-- ============================================================
-- 3. PRACTICE_SESSIONS TABLE
-- Stores individual practice question attempts with scoring
-- ============================================================
CREATE TABLE IF NOT EXISTS practice_sessions (
  id              BIGSERIAL PRIMARY KEY,
  question_id     TEXT NOT NULL,
  question_title  TEXT NOT NULL,
  category        TEXT NOT NULL,
  answer          TEXT NOT NULL,
  score           INTEGER NOT NULL DEFAULT 0 CHECK (score >= 0 AND score <= 100),
  strengths       TEXT[] DEFAULT '{}',
  improvements    TEXT[] DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_practice_category ON practice_sessions(category);
CREATE INDEX IF NOT EXISTS idx_practice_created ON practice_sessions(created_at DESC);

-- ============================================================
-- 4. TELEMETRY TABLE
-- Edge telemetry for API latency monitoring and observability
-- ============================================================
CREATE TABLE IF NOT EXISTS telemetry (
  id            BIGSERIAL PRIMARY KEY,
  endpoint      TEXT NOT NULL,
  latency_ms    INTEGER NOT NULL DEFAULT 0,
  status        TEXT NOT NULL DEFAULT 'success'
                  CHECK (status IN ('success', 'error')),
  error_message TEXT,
  timestamp     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_telemetry_endpoint ON telemetry(endpoint);
CREATE INDEX IF NOT EXISTS idx_telemetry_timestamp ON telemetry(timestamp DESC);

-- ============================================================
-- 5. ACHIEVEMENTS TABLE
-- Gamification unlocks and user milestones
-- ============================================================
CREATE TABLE IF NOT EXISTS achievements (
  id            BIGSERIAL PRIMARY KEY,
  code          TEXT NOT NULL UNIQUE,
  title         TEXT NOT NULL,
  description   TEXT NOT NULL,
  icon          TEXT NOT NULL,
  unlocked_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_achievements_code ON achievements(code);

-- ============================================================
-- 6. ORAMA_INDEX TABLE
-- Local search index persistence for Orama full-text search
-- ============================================================
CREATE TABLE IF NOT EXISTS orama_index (
  id          TEXT PRIMARY KEY,
  data        JSONB NOT NULL,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 7. ASSESSMENTS TABLE
-- Recruiter-generated assessment templates with AI questions
-- ============================================================
CREATE TABLE IF NOT EXISTS assessments (
  id              BIGSERIAL PRIMARY KEY,
  title           TEXT NOT NULL,
  job_description TEXT NOT NULL,
  questions       JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_assessments_created ON assessments(created_at DESC);

-- ============================================================
-- AUTO-UPDATE TRIGGER: updated_at columns
-- ============================================================
CREATE OR REPLACE FUNCTION update_modified_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply auto-update triggers to tables with updated_at
DO $$ 
BEGIN
  -- interviews
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_interviews_updated') THEN
    CREATE TRIGGER trg_interviews_updated
      BEFORE UPDATE ON interviews
      FOR EACH ROW EXECUTE FUNCTION update_modified_column();
  END IF;

  -- evaluations
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_evaluations_updated') THEN
    CREATE TRIGGER trg_evaluations_updated
      BEFORE UPDATE ON evaluations
      FOR EACH ROW EXECUTE FUNCTION update_modified_column();
  END IF;

  -- orama_index
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_orama_updated') THEN
    CREATE TRIGGER trg_orama_updated
      BEFORE UPDATE ON orama_index
      FOR EACH ROW EXECUTE FUNCTION update_modified_column();
  END IF;

  -- assessments
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_assessments_updated') THEN
    CREATE TRIGGER trg_assessments_updated
      BEFORE UPDATE ON assessments
      FOR EACH ROW EXECUTE FUNCTION update_modified_column();
  END IF;
END $$;

-- ============================================================
-- ROW LEVEL SECURITY (RLS)
-- Enable RLS on all tables. Configure policies per your
-- authentication strategy (Supabase Auth, API key, etc.)
-- ============================================================
ALTER TABLE interviews       ENABLE ROW LEVEL SECURITY;
ALTER TABLE evaluations      ENABLE ROW LEVEL SECURITY;
ALTER TABLE practice_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE telemetry        ENABLE ROW LEVEL SECURITY;
ALTER TABLE achievements     ENABLE ROW LEVEL SECURITY;
ALTER TABLE orama_index      ENABLE ROW LEVEL SECURITY;
ALTER TABLE assessments      ENABLE ROW LEVEL SECURITY;

-- Permissive policies for service-role access (adjust for your auth)
-- These allow all operations through service role key
CREATE POLICY "Allow all for service role" ON interviews
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow all for service role" ON evaluations
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow all for service role" ON practice_sessions
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow all for service role" ON telemetry
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow all for service role" ON achievements
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow all for service role" ON orama_index
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow all for service role" ON assessments
  FOR ALL USING (true) WITH CHECK (true);

-- ============================================================
-- VERIFICATION: List all created tables
-- ============================================================
SELECT table_name, 
       (SELECT COUNT(*) FROM information_schema.columns c 
        WHERE c.table_name = t.table_name AND c.table_schema = 'public') as column_count
FROM information_schema.tables t
WHERE table_schema = 'public' 
  AND table_type = 'BASE TABLE'
  AND table_name IN (
    'interviews', 'evaluations', 'practice_sessions',
    'telemetry', 'achievements', 'orama_index', 'assessments'
  )
ORDER BY table_name;
