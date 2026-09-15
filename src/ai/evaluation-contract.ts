// Phase 4: evidence-grounded evaluation contract (8.2-8.6).
//
// Rules enforced here, not just in prose:
// - Every scored dimension REQUIRES >=1 evidence quote (Zod .min(1)).
// - Scores are 1-5 rubric anchors; 0-100 is derived deterministically.
// - Evaluator confidence (high/medium/low) describes EVIDENCE SUFFICIENCY,
//   never candidate psychology.
// - Practice readiness replaces hire/no-hire verdicts, with a disclaimer.
// - No culture-fit / personality / protected-attribute inference anywhere.
import { z } from "zod";
import { anchorToScore100 } from "./rubrics";

export const EVALUATION_VERSION = "2.0";

export const READINESS_LEVELS = [
  "needs_foundation",
  "developing",
  "interview_ready",
  "strongly_prepared",
] as const;

export type ReadinessLevel = (typeof READINESS_LEVELS)[number];

export const READINESS_META: Record<ReadinessLevel, { label: string; labelZh: string; description: string }> = {
  needs_foundation: {
    label: "Needs Foundation",
    labelZh: "需要夯实基础",
    description: "Core gaps across several dimensions. Focus on fundamentals before mocking at full difficulty.",
  },
  developing: {
    label: "Developing",
    labelZh: "稳步提升中",
    description: "Uneven performance: real strengths plus clear, fixable gaps. Targeted drills recommended.",
  },
  interview_ready: {
    label: "Interview Ready",
    labelZh: "已具备面试水准",
    description: "Consistently solid across dimensions with evidence. Ready for real interviews with light polish.",
  },
  strongly_prepared: {
    label: "Strongly Prepared",
    labelZh: "准备充分",
    description: "Strong evidence across dimensions, including depth that exceeds the bar.",
  },
};

export const READINESS_DISCLAIMER =
  "Training estimate for interview practice only — not an employment decision. Scores reflect evidence in this session, not hiring suitability.";

export const DimensionSchema = z.object({
  id: z.string().min(1).max(64),
  /** 1-5 rubric anchor level. */
  score: z.number().int().min(1).max(5),
  /** Verbatim quotes from THIS transcript supporting the score (>=1). */
  evidence: z.array(z.string().min(1).max(500)).min(1).max(6),
  rationale: z.string().min(1).max(1000),
  /** Evaluator certainty about THIS dimension given the evidence. */
  confidence: z.enum(["high", "medium", "low"]),
  improvement: z.string().min(1).max(500),
});

export type DimensionResult = z.infer<typeof DimensionSchema>;

export const EvaluationV2Schema = z.object({
  version: z.literal(EVALUATION_VERSION),
  rubricId: z.string().min(1).max(64),
  readiness: z.enum(READINESS_LEVELS),
  readinessRationale: z.string().min(1).max(1500),
  dimensions: z.array(DimensionSchema).min(1).max(8),
  strengths: z.array(z.string().min(1).max(300)).min(1).max(5),
  weaknesses: z.array(z.string().min(1).max(300)).min(1).max(5),
  /** Next deliberate-practice drills (feeds the Phase 7 practice loop). */
  nextDrills: z.array(z.string().min(1).max(300)).min(1).max(5),
  qaReview: z.array(
    z.object({
      question: z.string().min(1).max(2000),
      userAnswer: z.string().min(1).max(8000),
      flaws: z.string().min(1).max(2000),
      perfectRewrite: z.string().min(1).max(4000),
    })
  ).max(30),
  timelineEvents: z.array(
    z.object({
      id: z.string().min(1).max(64),
      timestamp: z.number().min(0),
      type: z.enum(["question", "answer", "feedback", "milestone", "warning"]),
      title: z.string().min(1).max(300),
      description: z.string().max(1000).optional(),
    })
  ).max(30).optional(),
  trainingRoadmap: z.object({
    technical: z.array(z.string().max(300)).max(10),
    behavioral: z.array(z.string().max(300)).max(10),
    resources: z.array(z.string().max(300)).max(10),
  }).optional(),
});

export type EvaluationV2 = z.infer<typeof EvaluationV2Schema>;

/** UI 0-100 for a dimension (deterministic). */
export function dimensionScore100(d: Pick<DimensionResult, "score">): number {
  return anchorToScore100(d.score);
}

/** Overall evaluator confidence = weakest dimension (explainable). */
export function overallConfidence(dims: Pick<DimensionResult, "confidence">[]): "high" | "medium" | "low" {
  if (dims.some((d) => d.confidence === "low")) return "low";
  if (dims.some((d) => d.confidence === "medium")) return "medium";
  return "high";
}

/** Mean of deterministic dimension scores, rounded. */
export function evaluationAverage(dims: Pick<DimensionResult, "score">[]): number {
  if (dims.length === 0) return 0;
  return Math.round(dims.reduce((a, d) => a + dimensionScore100(d), 0) / dims.length);
}
