// Phase 4: legacy ↔ V2 compatibility adapter.
//
// New sessions write `evaluationV2` only. Historical rows carry the Phase 1
// schema (council/hireVerdict/culturalTraits/radarScores). This adapter lets
// every consumer render EITHER shape through one view model, with legacy
// rows explicitly badged — history is preserved, never rewritten.
import type { Interview } from "@/lib/db";
import {
  evaluationAverage,
  overallConfidence,
  type EvaluationV2,
} from "@/ai/evaluation-contract";

export interface DimensionView {
  id: string;
  name: string;
  score100: number;
  anchorLevel: number | null;
  evidence: string[];
  rationale: string;
  confidence: "high" | "medium" | "low";
  improvement: string;
}

export interface EvaluationView {
  kind: "v2" | "legacy" | "none";
  /** True for pre-V2 rows: UI must badge "Legacy assessment". */
  legacy: boolean;
  /** Rubric that produced V2 rows (for drill mapping); null for legacy. */
  rubricId: string | null;
  readinessLabel: string | null;
  readinessRationale: string | null;
  average: number | null;
  confidence: "high" | "medium" | "low" | null;
  dimensions: DimensionView[];
  strengths: string[];
  weaknesses: string[];
  nextDrills: string[];
  disclaimer: string | null;
}

const LEGACY_DIMENSION_NAMES: Record<string, string> = {
  logic: "Logic",
  expression: "Expression",
  professionalism: "Professionalism",
  confidence: "Confidence (legacy)",
  pressure: "Pressure Handling (legacy)",
  bodyLanguage: "Body Language (legacy)",
  systemDesign: "System Design",
};

function legacyDimensions(interview: Interview): DimensionView[] {
  const r = interview.radarScores;
  if (!r) return [];
  const entries: [string, number | undefined][] = [
    ["logic", r.logic],
    ["expression", r.expression],
    ["professionalism", r.professionalism],
    ["confidence", r.confidence],
    ["pressure", r.pressure],
    ["bodyLanguage", r.bodyLanguage],
    ["systemDesign", r.systemDesign],
  ];
  return entries
    .filter(([, v]) => typeof v === "number")
    .map(([id, v]) => ({
      id,
      name: LEGACY_DIMENSION_NAMES[id] ?? id,
      score100: Math.round(v as number),
      anchorLevel: null,
      evidence: [],
      rationale: "Pre-rubric score: no per-dimension evidence was captured for this session.",
      confidence: "low" as const,
      improvement: "Re-run this interview type to get an evidence-grounded assessment.",
    }));
}

const LEGACY_VERDICT_LABELS: Record<string, string> = {
  strong_hire: "Strong Hire (legacy)",
  hire: "Hire (legacy)",
  leaning_hire: "Leaning Hire (legacy)",
  leaning_no_hire: "Leaning No Hire (legacy)",
  no_hire: "No Hire (legacy)",
};

export function toEvaluationView(interview: Interview): EvaluationView {
  const v2 = interview.evaluationV2 as EvaluationV2 | undefined;
  if (v2 && Array.isArray(v2.dimensions) && v2.dimensions.length > 0) {
    return {
      kind: "v2",
      legacy: false,
      rubricId: v2.rubricId ?? null,
      readinessLabel: v2.readiness,
      readinessRationale: v2.readinessRationale,
      average: evaluationAverage(v2.dimensions),
      confidence: overallConfidence(v2.dimensions),
      dimensions: v2.dimensions.map((d) => ({
        id: d.id,
        name: d.id,
        score100: Math.min(100, Math.max(0, d.score * 20)),
        anchorLevel: d.score,
        evidence: d.evidence,
        rationale: d.rationale,
        confidence: d.confidence,
        improvement: d.improvement,
      })),
      strengths: v2.strengths ?? [],
      weaknesses: v2.weaknesses ?? [],
      nextDrills: v2.nextDrills ?? [],
      disclaimer: null, // V2 UI renders the standard disclaimer itself.
    };
  }
  if (interview.radarScores || interview.hireVerdict || interview.qaReview) {
    const dims = legacyDimensions(interview);
    const avg = dims.length > 0 ? Math.round(dims.reduce((a, d) => a + d.score100, 0) / dims.length) : null;
    return {
      kind: "legacy",
      legacy: true,
      rubricId: null,
      readinessLabel: interview.hireVerdict ? (LEGACY_VERDICT_LABELS[interview.hireVerdict] ?? interview.hireVerdict) : null,
      readinessRationale: interview.verdictRationale ?? null,
      average: avg,
      confidence: "low",
      dimensions: dims,
      strengths: [],
      weaknesses: [],
      nextDrills: [],
      disclaimer: "Legacy assessment (pre-rubric): scores were generated without anchored criteria or captured evidence.",
    };
  }
  return {
    kind: "none",
    legacy: false,
    rubricId: null,
    readinessLabel: null,
    readinessRationale: null,
    average: null,
    confidence: null,
    dimensions: [],
    strengths: [],
    weaknesses: [],
    nextDrills: [],
    disclaimer: null,
  };
}

/** Unified session score: V2 dimension mean, else legacy radar mean, else null. */
export function sessionScore(interview: Interview): number | null {
  return toEvaluationView(interview).average;
}
