import { dbClient } from './api-client';
import type { EvaluationV2 } from '@/ai/evaluation-contract';
import type { InterviewPlan } from '@/ai/interview/plan';

export interface TopPrediction {
  question: string;
  rationale: string;
  keyPointsToHit: string[];
}

export interface TimelineEvent {
  id: string;
  timestamp: number;
  type: 'question' | 'answer' | 'feedback' | 'milestone' | 'warning';
  title: string;
  description?: string;
  metadata?: Record<string, unknown>;
  messageId?: string;
}

export interface Interview {
  id?: number;
  title?: string;
  jobDescription?: string;
  resumeText?: string;
  includeCoding?: boolean;
  problemStatement?: string;
  cheatsheet?: string[];
  stressTest?: boolean;
  topPredictions?: TopPrediction[];
  status: 'pending' | 'in_progress' | 'completed';
  /**
   * Phase 7 goal-based session config. All optional/additive: older rows
   * and direct /interview links simply run engine defaults.
   */
  interviewType?: string;
  customTypeDescription?: string;
  difficulty?: string;
  timeBudgetSec?: number;
  plan?: InterviewPlan;
  radarScores?: {
    logic: number;
    expression: number;
    professionalism: number;
    confidence: number;
    pressure: number;
    bodyLanguage: number;
    systemDesign?: number;
  };
  qaReview?: {
    question: string;
    userAnswer: string;
    flaws: string;
    perfectRewrite: string;
  }[];
  deliveryStats?: {
    wpm: number;
    fillerWords: number;
    /** Phase 8 observable analytics (all optional/additive). */
    interruptions?: number;
    avgAnswerSec?: number;
    avgRoundTripMs?: number;
    sttAvgConfidence?: number;
    sttFinals?: number;
    sttReconnects?: number;
    /** Phase 13 latency breakdown averages, ms (optional/additive). */
    ttftMs?: number;
    whisperMs?: number;
    ttsStartupMs?: number;
  };
  hireVerdict?: 'strong_hire' | 'hire' | 'leaning_hire' | 'leaning_no_hire' | 'no_hire';
  verdictRationale?: string;
  /**
   * Phase 4 evidence-grounded evaluation. Written by all NEW sessions.
   * Legacy fields above are read-only history (see eval-compat adapter).
   */
  evaluationV2?: EvaluationV2;
  councilDebate?: {
    technicalAdvisor: { stance: string; reasoning: string };
    hrAdvisor: { stance: string; reasoning: string };
    cultureFitAdvisor: { stance: string; reasoning: string };
  };
  timelineEvents?: TimelineEvent[];
  matchData?: {
    overallScore: number;
    alignedSkills: string[];
    missingSkills: string[];
    recommendations: string[];
  };
  culturalTraits?: {
    trait: string;
    score: number;
    evidence: string;
  }[];
  trainingRoadmap?: {
    technical: string[];
    behavioral: string[];
    resources: string[];
  };
  transcript?: {
    id: string;
    role: string;
    content: string;
    createdAt?: Date;
  }[];
  createdAt: Date;
  updatedAt: Date;
}

export interface OramaIndexData {
  id: string;
  data: unknown;
  updatedAt: Date;
}

export interface PracticeSession {
  id?: number;
  questionId: string;
  questionTitle: string;
  category: string;
  answer: string;
  score: number;
  strengths: string[];
  improvements: string[];
  /**
   * Practice evidence persistence (EVALUATION_V2 §9): verbatim quotes +
   * evaluator confidence behind the score. Optional/additive — older rows
   * without them render exactly as before (history preserved, never rewritten).
   */
  evidence?: string[];
  confidence?: "high" | "medium" | "low";
  createdAt: Date;
}

export interface CandidateEvaluation {
  id?: number;
  candidateId: string;
  notes: string;
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface Assessment {
  id?: number;
  title: string;
  jobDescription: string;
  questions: {
    question: string;
    rationale: string;
    expectedSkills: string[];
  }[];
  createdAt: Date;
  updatedAt: Date;
}

export interface Achievement {
  id?: number;
  code: string;
  title: string;
  description: string;
  icon: string;
  unlockedAt: Date;
}

export interface TelemetryEvent {
  id?: number;
  endpoint: string;
  latencyMs: number;
  status: 'success' | 'error';
  errorMessage?: string;
  timestamp: Date;
}

const db = dbClient;

export { db };
