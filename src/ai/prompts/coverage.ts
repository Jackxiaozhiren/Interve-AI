// Phase 6 prompt registry: interview-loop coverage section.
//
// Rendered server-side from synthesized InterviewState every turn. This is
// the Follow-up Planner output: transparent gap list + difficulty + time,
// replacing the removed stealth-probing instructions.
export const COVERAGE_PROMPT_ID = "interview-coverage";
export const COVERAGE_PROMPT_VERSION = "1.0.0";

import { remainingSec, type InterviewState } from "../interview/state";

const DIFFICULTY_LABELS: Record<string, string> = {
  easy: "Easy",
  medium: "Medium",
  hard: "Hard",
  expert: "Expert",
};

export function buildCoverageSection(state: InterviewState, now = Date.now()): string {
  const remaining = remainingSec(state, now);
  const total = state.timeBudgetSec;
  const lines: string[] = [];
  lines.push(`【Interview State — turn ${state.turnCount} · difficulty ${DIFFICULTY_LABELS[state.difficulty] ?? state.difficulty} · ~${remaining}s of ${total}s left】`);

  const avgs: string[] = [];
  avgs.push(`STAR avg ${state.starAvg !== null ? `${Math.round(state.starAvg)}/100` : "n/a"}`);
  avgs.push(`behavioral avg ${state.traitsAvg !== null ? `${Math.round(state.traitsAvg)}/100` : "n/a"}`);
  lines.push(`- Estimated coverage (experimental analyzer snapshots, may lag one turn): ${avgs.join(", ")}.`);

  if (state.followUpTargets.length > 0) {
    lines.push(`- Open gaps to probe, in priority order:`);
    for (const t of state.followUpTargets) lines.push(`  - ${t}`);
  } else {
    lines.push(`- No specific gaps identified; advance the interview plan.`);
  }

  const recent = state.questionHistory.slice(-3).map((q) => q.question);
  if (recent.length > 0) {
    lines.push(`- Recent questions (do not mechanically repeat):`);
    recent.forEach((q, i) => lines.push(`  ${i + 1}. ${q.slice(0, 160)}`));
  }

  lines.push(`- Ask the next question at ${DIFFICULTY_LABELS[state.difficulty] ?? state.difficulty} level.`);
  if (remaining < total * 0.2) {
    lines.push(`- Time is short: ask at most one focused closing question, then wrap up.`);
  }
  return lines.join("\n");
}
