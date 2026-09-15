// Phase 7: curated weakness drill bank (14).
//
// Static, expert-written practice tasks — one per rubric dimension.
// Deliberately NOT LLM-generated at runtime: deterministic, reviewable,
// zero-cost. `drillsFor()` maps an EvaluationV2's weakest dimensions to
// tasks (Practice → Evaluate → Diagnose → Drill → Retry loop).

export interface Drill {
  id: string;
  dimensionId: string;
  rubricId: string;
  title: string;
  titleZh: string;
  /** The practice task shown to the candidate. */
  task: string;
  tip: string;
}

function drill(
  rubricId: string, dimensionId: string, title: string, titleZh: string, task: string, tip: string
): Drill {
  return { id: `${rubricId}:${dimensionId}`, dimensionId, rubricId, title, titleZh, task, tip };
}

export const DRILL_BANK: Drill[] = [
  // behavioral-v1
  drill("behavioral-v1", "relevance", "Answer the Question Asked", "切题训练", "Take your last interview answer and rewrite its first two sentences so they directly answer the question. Read both versions aloud.", "If the first sentence could fit any question, it fits none."),
  drill("behavioral-v1", "star_completeness", "STAR Gap Fill", "STAR补全", "Pick one past answer. Label its S/T/A/R parts. For each missing part, write 2-3 sentences from memory, then re-deliver the full story in under 2 minutes.", "Time yourself: complete STAR stories land in 90-150 seconds."),
  drill("behavioral-v1", "specificity", "Numbers Hunt", "细节量化", "Rewrite one story adding: one date or duration, one constraint, one number, and three 'I' statements replacing 'we'.", "Vague verbs (helped, worked on, involved) are the tell — replace each."),
  drill("behavioral-v1", "ownership", "Own the Failure", "复盘担当", "Describe one thing that went wrong on your watch: what YOU decided, what it cost, and what process you changed afterward.", "No blameless-postmortem language. Name your decision first."),
  drill("behavioral-v1", "impact", "Impact Audit", "影响力量化", "For your three strongest stories, add the measurable outcome (%, $, time, users). If truly unmeasurable, state the leading indicator you moved.", "Interviewers discount unquantified wins by default."),
  drill("behavioral-v1", "reflection", "Second-Order Lesson", "深度复盘", "For one story, write what you would do differently with double the staff and with half the time. One paragraph each.", "Shows judgment, not just hindsight."),
  // technical-v1
  drill("technical-v1", "correctness", "Teach It Back", "讲透概念", "Explain one core concept from your stack as if to a smart intern. Record 3 minutes, then check every claim against docs.", "Hesitation points are your study list."),
  drill("technical-v1", "decomposition", "Split the Problem", "问题拆解", "Take a past take-home or ticket and write the sub-problem list BEFORE any solution. Compare with what you actually did first.", "The first split should take 5 minutes, not 50."),
  drill("technical-v1", "assumptions", "Assumption Log", "假设清单", "Revisit one design decision. List every assumption you made silently, then mark which you validated and how.", "Unstated assumptions are where interviews die."),
  drill("technical-v1", "tradeoffs", "Two-Column Compare", "权衡对比", "Pick two approaches you have used (e.g. polling vs webhooks). Compare on complexity, ops cost, and failure modes. Choose explicitly.", "No 'it depends' without saying what it depends on."),
  drill("technical-v1", "depth", "Five Whys Drill", "深度追问", "Have a peer ask 'why' five times about one system you built. Write down where you bottomed out — study exactly that layer.", "Depth is proven one level past comfort."),
  drill("technical-v1", "communication", "Whiteboard Narration", "技术表达", "Explain a recent bug fix in 2 minutes while drawing boxes. No code, only structure and causality.", "If you cannot draw it, you cannot explain it."),
  // system-design-v1
  drill("system-design-v1", "clarification", "Scope First", "需求澄清", "Given any 'design X' prompt, spend 5 minutes writing ONLY requirements, scale numbers, and non-goals before touching components.", "Interviewers score the first 5 minutes heaviest."),
  drill("system-design-v1", "architecture", "Component Justification", "架构论证", "Redraw your last architecture and annotate EVERY arrow with what flows and why this store (not another).", "Unlabeled arrows are the most common failure."),
  drill("system-design-v1", "scalability", "10x Drill", "扩展性推演", "Take your design and ask: what breaks first at 10x traffic? Write the fix and its cost. Repeat at 100x.", "'Add caching' without placement earns nothing."),
  drill("system-design-v1", "reliability", "Kill a Box", "可靠性推演", "Delete each component of your diagram in turn. For each: who notices, what degrades, what pages you. Write the mitigation.", "If nothing pages you, your observability answer is missing."),
  drill("system-design-v1", "tradeoffs", "Decision Record", "架构决策记录", "Write a one-page ADR for your hardest past decision: context, options, decision, consequences.", "Real ADRs beat remembered opinions."),
  drill("system-design-v1", "communication", "Guided Tour", "设计讲解", "Present your diagram in 5 minutes to a timer. Then answer three hostile 'why not Y?' questions in writing.", "Narration is a separate skill from drawing."),
  // data-ml-v1
  drill("data-ml-v1", "framing", "Metric First", "指标先行", "Restate your last ML task as: prediction target, decision it informs, offline metric, and launch bar. One paragraph.", "No metric, no model discussion."),
  drill("data-ml-v1", "data_assumptions", "Leakage Hunt", "泄露排查", "List every feature of one model and mark when each becomes known relative to prediction time. Kill the time-travelers.", "Leakage is the #1 silent killer in ML interviews."),
  drill("data-ml-v1", "modeling", "Baseline Discipline", "基线思维", "Describe the dumbest model that could work for your problem and what it would take to beat it.", "Strong candidates start simple on purpose."),
  drill("data-ml-v1", "evaluation", "Slice the Errors", "误差分析", "Take 20 errors from any classifier (or imagine them) and bucket by cause. Propose one fix per bucket.", "Aggregate metrics hide the story; slices tell it."),
  drill("data-ml-v1", "experimentation", "One-Variable Test", "对照实验", "Write up one past change as hypothesis → single-variable test → result → next step. No multi-change stories.", "Confounded experiments signal junior thinking."),
  drill("data-ml-v1", "deployment", "Launch Checklist", "上线清单", "Write serving, cost-per-prediction, rollback, and three monitors for one model you know.", "Training is 20% of the interview; production is the rest."),
  // general-v1
  drill("general-v1", "relevance", "First-Sentence Rule", "首句切题", "Answer five common questions with ONLY the first sentence, then stop. Each must stand alone as an answer.", "Rambling starts when the first sentence doesn't commit."),
  drill("general-v1", "specificity", "Concrete Swap", "具体化替换", "Take one generic paragraph you say often. Replace every abstract noun with a name, number, or date.", "Do it in writing first, then aloud."),
  drill("general-v1", "depth", "One Level Deeper", "再深一层", "Pick any claim on your resume. Write the mechanism behind it until you hit something you cannot explain. Study that.", "Your resume is a menu of follow-ups."),
  drill("general-v1", "communication", "60-Second Brief", "电梯陈述", "Summarize your current project in 60 seconds: problem, approach, result. Record and cut filler.", "If it needs 5 minutes, the structure is missing."),
];

const byId = new Map(DRILL_BANK.map((d) => [d.id, d]));

/** Drills for the weakest dimensions of an evaluation (score ascending). */
export function drillsForWeaknesses(
  dims: { id: string; rubricId: string; score: number }[],
  limit = 3
): Drill[] {
  const out: Drill[] = [];
  const sorted = [...dims].sort((a, b) => a.score - b.score);
  for (const d of sorted) {
    if (out.length >= limit) break;
    const hit = byId.get(`${d.rubricId}:${d.id}`) ?? byId.get(`general-v1:${d.id}`);
    if (hit && !out.includes(hit)) out.push(hit);
  }
  return out;
}

export const DRILL_BANK_VERSION = "1.0.0";
