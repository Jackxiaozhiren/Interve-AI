import { dbClient } from './api-client';

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
  };
  hireVerdict?: 'strong_hire' | 'hire' | 'leaning_hire' | 'leaning_no_hire' | 'no_hire';
  verdictRationale?: string;
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
