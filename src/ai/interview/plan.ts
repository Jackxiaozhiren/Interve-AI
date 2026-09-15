// Phase 7: interview plan + skill gap matrix (12.1, 12.3).
//
// Deterministic assembly from REAL inputs: the setup alignment report
// (LLM-produced strengths/gaps, labeled as estimates) + the selected
// interview type's rubric dimensions. No new AI calls, no invented skills:
// rows the alignment never mentioned are marked "unknown", never "gap".

export interface GapRow {
  /** Skill/competency label (from alignment output or rubric dimension). */
  skill: string;
  /** Mentioned as aligned/strength. */
  evidenced: boolean;
  /** Mentioned as missing/weak. */
  flagged: boolean;
  status: "strength" | "gap" | "unknown";
}

export interface InterviewPlan {
  version: "1.0.0";
  interviewTypeId: string;
  rubricId: string;
  difficulty: string;
  timeBudgetSec: number;
  /** Ordered probe priorities for this session. */
  focusAreas: string[];
  gaps: GapRow[];
  /** True when built without an alignment report (all rows unknown). */
  ungrounded: boolean;
}

export function buildGapMatrix(opts: {
  strengths?: string[];
  gaps?: string[];
  rubricDimensions: { id: string; name: string }[];
}): GapRow[] {
  const strengths = opts.strengths ?? [];
  const gaps = opts.gaps ?? [];
  const rows: GapRow[] = [];
  const seen = new Set<string>();
  const key = (s: string) => s.trim().toLowerCase();
  for (const s of strengths) {
    if (!s || seen.has(key(s))) continue;
    seen.add(key(s));
    rows.push({ skill: s.trim(), evidenced: true, flagged: false, status: "strength" });
  }
  for (const g of gaps) {
    if (!g || seen.has(key(g))) continue;
    seen.add(key(g));
    rows.push({ skill: g.trim(), evidenced: false, flagged: true, status: "gap" });
  }
  for (const d of opts.rubricDimensions) {
    if (seen.has(key(d.name)) || seen.has(key(d.id))) continue;
    seen.add(key(d.name));
    rows.push({ skill: d.name, evidenced: false, flagged: false, status: "unknown" });
  }
  return rows;
}

export function buildInterviewPlan(opts: {
  interviewTypeId: string;
  rubricId: string;
  rubricDimensions: { id: string; name: string }[];
  difficulty: string;
  timeBudgetSec: number;
  strengths?: string[];
  gaps?: string[];
}): InterviewPlan {
  const gaps = buildGapMatrix({ strengths: opts.strengths, gaps: opts.gaps, rubricDimensions: opts.rubricDimensions });
  const flagged = gaps.filter((g) => g.status === "gap").map((g) => g.skill);
  const focusAreas = [...flagged.slice(0, 3)];
  // Fill remaining focus from rubric dimensions (unknown coverage first).
  for (const d of opts.rubricDimensions) {
    if (focusAreas.length >= 4) break;
    if (!flagged.includes(d.name)) focusAreas.push(d.name);
  }
  return {
    version: "1.0.0",
    interviewTypeId: opts.interviewTypeId,
    rubricId: opts.rubricId,
    difficulty: opts.difficulty,
    timeBudgetSec: opts.timeBudgetSec,
    focusAreas,
    gaps,
    ungrounded: (opts.strengths ?? []).length === 0 && (opts.gaps ?? []).length === 0,
  };
}
