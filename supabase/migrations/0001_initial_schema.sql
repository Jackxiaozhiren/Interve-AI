-- Supabase Initial Schema for Interve AI

-- Interviews Table
CREATE TABLE public.interviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT,
  job_description TEXT,
  resume_text TEXT,
  include_coding BOOLEAN DEFAULT false,
  problem_statement TEXT,
  cheatsheet JSONB DEFAULT '[]'::jsonb,
  stress_test BOOLEAN DEFAULT false,
  top_predictions JSONB DEFAULT '[]'::jsonb,
  status TEXT NOT NULL CHECK (status IN ('pending', 'in_progress', 'completed')),
  radar_scores JSONB,
  qa_review JSONB,
  delivery_stats JSONB,
  hire_verdict TEXT,
  verdict_rationale TEXT,
  council_debate JSONB,
  timeline_events JSONB DEFAULT '[]'::jsonb,
  match_data JSONB,
  cultural_traits JSONB DEFAULT '[]'::jsonb,
  training_roadmap JSONB,
  transcript JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Practice Sessions
CREATE TABLE public.practice_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id TEXT NOT NULL,
  question_title TEXT NOT NULL,
  category TEXT NOT NULL,
  answer TEXT NOT NULL,
  score INTEGER NOT NULL,
  strengths JSONB DEFAULT '[]'::jsonb,
  improvements JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Evaluations
CREATE TABLE public.evaluations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id TEXT NOT NULL,
  notes TEXT NOT NULL,
  tags JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Assessments
CREATE TABLE public.assessments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  job_description TEXT NOT NULL,
  questions JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Achievements
CREATE TABLE public.achievements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  icon TEXT NOT NULL,
  unlocked_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Telemetry
CREATE TABLE public.telemetry (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  endpoint TEXT NOT NULL,
  latency_ms INTEGER NOT NULL,
  status TEXT NOT NULL,
  error_message TEXT,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Orama Index (Not strictly needed in PG, but kept for parity if stored as a blob)
CREATE TABLE public.orama_index (
  id TEXT PRIMARY KEY,
  data JSONB,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
