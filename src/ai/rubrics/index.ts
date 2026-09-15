// Phase 4: versioned competency rubrics (8.1, 8.3).
//
// Each dimension carries 1-5 BEHAVIORAL ANCHORS. The evaluator must pick a
// level whose anchor matches the observed evidence — it must NOT invent its
// own standard. UI-facing 0-100 values are derived deterministically
// (score * 20), never emitted by the model.

export interface RubricAnchor {
  level: 1 | 2 | 3 | 4 | 5;
  label: string;
  description: string;
}

export interface RubricDimension {
  id: string;
  name: string;
  nameZh: string;
  guidance: string;
  anchors: [RubricAnchor, RubricAnchor, RubricAnchor, RubricAnchor, RubricAnchor];
}

export interface Rubric {
  /** Stable id, e.g. "behavioral-v1". Bumped on any anchor change. */
  id: string;
  version: string;
  track: string;
  trackZh: string;
  dimensions: RubricDimension[];
}

function d(
  id: string,
  name: string,
  nameZh: string,
  guidance: string,
  a1: string, a2: string, a3: string, a4: string, a5: string
): RubricDimension {
  const labels = ["Absent", "Emerging", "Proficient", "Strong", "Exemplary"] as const;
  const descs = [a1, a2, a3, a4, a5];
  return {
    id, name, nameZh, guidance,
    anchors: descs.map((description, i) => ({
      level: (i + 1) as 1 | 2 | 3 | 4 | 5,
      label: labels[i],
      description,
    })) as [RubricAnchor, RubricAnchor, RubricAnchor, RubricAnchor, RubricAnchor],
  };
}

export const behavioralRubric: Rubric = {
  id: "behavioral-v1",
  version: "1.0.0",
  track: "Behavioral",
  trackZh: "行为面试",
  dimensions: [
    d("relevance", "Relevance", "切题度",
      "Does the answer address what was asked, without drifting?",
      "No discernible link to the question.",
      "Tangential: mentions the topic but never answers it.",
      "Answers the question with minor drift.",
      "Directly answers with well-chosen detail.",
      "Answers precisely and anticipates the natural follow-up."),
    d("star_completeness", "STAR Completeness", "STAR完整度",
      "Situation, Task, Action, Result — which elements are present?",
      "No STAR structure; free-form remarks.",
      "One element present (usually vague Action).",
      "Two to three elements present; one is thin.",
      "All four elements present and connected.",
      "All four present, tightly linked, with reflective close."),
    d("specificity", "Specificity", "具体程度",
      "Names, numbers, constraints, first-person actions — or generalities?",
      "Pure generalities, no concrete detail.",
      "One concrete detail; rest is generic.",
      "Several concrete details; personal role partly clear.",
      "Concrete, first-person account with context and constraints.",
      "Rich, verifiable detail (metrics, trade-offs, dates) throughout."),
    d("ownership", "Ownership", "主人翁意识",
      "Does the candidate own outcomes, including failures?",
      "Deflects: credits/blames others, no personal accountability.",
      "Passive participation; team did, candidate watched.",
      "Clear personal contribution; limited reflection on setbacks.",
      "Owns decisions and outcomes; candid about mistakes.",
      "Owns outcomes end-to-end and shows what changed afterwards."),
    d("impact", "Impact", "影响力",
      "Is there a stated result, ideally quantified?",
      "No result of any kind is stated.",
      "Vague positive claim without support.",
      "Plausible result, unquantified.",
      "Quantified or otherwise concrete result tied to the action.",
      "Significant quantified impact plus second-order effects or learning."),
    d("reflection", "Reflection", "复盘深度",
      "Does the candidate extract a lesson or alternative?",
      "No reflection; narrative just stops.",
      "Cliché lesson with no link to the story.",
      "Reasonable takeaway connected to events.",
      "Insightful lesson with a concrete behavior change.",
      "Deep, transferable insight applied to later work."),
  ],
};

export const technicalRubric: Rubric = {
  id: "technical-v1",
  version: "1.0.0",
  track: "Technical",
  trackZh: "技术面试",
  dimensions: [
    d("correctness", "Correctness", "正确性",
      "Is the technical content right?",
      "Fundamentally incorrect statements.",
      "Partially correct with material errors.",
      "Broadly correct; minor inaccuracies.",
      "Correct with precise terminology.",
      "Correct, precise, and anticipates edge cases unprompted."),
    d("decomposition", "Problem Decomposition", "问题拆解",
      "Breaks the problem into tractable parts?",
      "No structure; jumps at the solution.",
      "One split, rest is monolithic.",
      "Sensible decomposition, loosely ordered.",
      "Clear decomposition with dependencies noted.",
      "Exemplary breakdown with prioritization and risk order."),
    d("assumptions", "Assumptions", "假设与澄清",
      "States and checks assumptions instead of guessing silently?",
      "Acts on unstated, wrong assumptions.",
      "Assumes without checking.",
      "States key assumptions; checks the critical one.",
      "Explicit assumptions with validation for each.",
      "Proactively clarifies scope and constraints before solving."),
    d("tradeoffs", "Trade-offs", "权衡分析",
      "Compares alternatives with reasons?",
      "Single option presented as obvious.",
      "Mentions an alternative without comparison.",
      "Compares two options on one axis (e.g. complexity).",
      "Multi-axis comparison with a justified choice.",
      "Rich comparison (complexity, ops, cost, risk) with context fit."),
    d("depth", "Depth", "技术深度",
      "How far below the surface can they go?",
      "Buzzwords without substance.",
      "Shallow definitions only.",
      "Working knowledge with one level of follow-up.",
      "Deep, mechanism-level understanding.",
      "Expert depth: internals, failure modes, and limits."),
    d("communication", "Communication", "技术表达",
      "Role-relevant clarity: structured, checkable explanation?",
      "Incoherent or off-topic.",
      "Hard to follow; key terms undefined.",
      "Followable with minor gaps.",
      "Clear, structured, invites verification.",
      "Crisp, audience-aware, exemplary structure."),
  ],
};

export const systemDesignRubric: Rubric = {
  id: "system-design-v1",
  version: "1.0.0",
  track: "System Design",
  trackZh: "系统设计",
  dimensions: [
    d("clarification", "Requirement Clarification", "需求澄清",
      "Scope, scale, and constraints established before designing?",
      "Designs immediately with no scoping.",
      "One clarifying remark, then guesses.",
      "Core scope and rough scale stated.",
      "Scope, scale, and key constraints pinned down.",
      "Rigorous scoping incl. non-goals, SLOs, and capacity math."),
    d("architecture", "Architecture", "架构设计",
      "Components, data flow, storage choices fit the problem?",
      "No coherent architecture.",
      "Boxes without data flow or storage rationale.",
      "Plausible components and flow; weak storage story.",
      "Coherent end-to-end design with justified component choices.",
      "Elegant, minimal design covering data model, consistency, and APIs."),
    d("scalability", "Scalability", "可扩展性",
      "Handles 10x growth without redesign?",
      "Single-server thinking only.",
      "Names scaling buzzwords without placement.",
      "One real scaling lever (cache/queue/shard) placed correctly.",
      "Multiple levers with bottleneck reasoning.",
      "Elastic design with quantified headroom and partition strategy."),
    d("reliability", "Reliability", "可靠性",
      "SPOF, failover, observability addressed?",
      "No consideration of failures at all.",
      "Acknowledges failures vaguely.",
      "Names SPOFs or one mitigation.",
      "Replication/failover plus basic observability.",
      "Failure domains, recovery budgets, and monitoring end-to-end."),
    d("tradeoffs", "Trade-offs", "权衡分析",
      "Justifies choices against alternatives (incl. security/cost)?",
      "No alternatives considered.",
      "One alternative named, not compared.",
      "Basic comparison on one axis.",
      "Multi-axis justification incl. ops/cost/security.",
      "Principled trade-offs with explicit residual risks."),
    d("communication", "Communication", "设计表达",
      "Can they walk through the design, handle pushback, iterate?",
      "Cannot explain the drawing.",
      "Walks through partially; resists questions.",
      "Clear walkthrough; accepts corrections.",
      "Structured narration with active incorporation of feedback.",
      "Exemplary facilitation: drives the review, updates design live."),
  ],
};

export const dataMlRubric: Rubric = {
  id: "data-ml-v1",
  version: "1.0.0",
  track: "Data / ML",
  trackZh: "数据与机器学习",
  dimensions: [
    d("framing", "Problem Framing", "问题定义",
      "ML task, success metric, and baseline defined?",
      "Jumps to modeling with no framing.",
      "Vague goal, no metric.",
      "Task and rough metric stated.",
      "Clear task, metric, and baseline plan.",
      "Rigorous framing: metric trade-offs, slices, and launch bar."),
    d("data_assumptions", "Data Assumptions", "数据假设",
      "Sources, labels, leakage, and bias risks addressed?",
      "No discussion of data at all.",
      "Hand-waves data availability.",
      "Names sources and one risk.",
      "Concrete data plan with leakage guard.",
      "Full data diligence: provenance, splits, leakage, bias, drift."),
    d("modeling", "Modeling", "建模方案",
      "Sensible approach with justified complexity?",
      "Buzzword model, no rationale.",
      "One model named without justification.",
      "Reasonable choice with basic rationale.",
      "Well-justified approach with complexity control.",
      "Principled approach incl. ablations and fallback options."),
    d("evaluation", "Evaluation", "评估方法",
      "Offline/online evaluation, error analysis?",
      "Accuracy-only or no evaluation.",
      "Single metric, no analysis.",
      "Sensible metrics with basic error look.",
      "Slice-aware evaluation with error analysis.",
      "Rigorous eval: slices, ablations, leakage checks, online plan."),
    d("experimentation", "Experimentation", "实验迭代",
      "Iterates from evidence, not hunches?",
      "No account of iteration whatsoever.",
      "Random tweaks described.",
      "One evidence-driven iteration.",
      "Systematic iteration with hypotheses.",
      "Exemplary experimental discipline with negative results."),
    d("deployment", "Deployment & Monitoring", "部署与监控",
      "Serving, cost, and monitoring considered?",
      "No deployment thinking.",
      "Mentions deployment vaguely.",
      "Basic serving sketch.",
      "Serving + cost + key monitors.",
      "Production-grade plan: rollout, rollback, drift, retraining."),
  ],
};

export const generalRubric: Rubric = {
  id: "general-v1",
  version: "1.0.0",
  track: "General",
  trackZh: "综合面试",
  dimensions: [
    d("relevance", "Relevance", "切题度",
      "Answers what was asked?",
      "No discernible link to the question asked.",
      "Mentions the topic but never actually answers it.",
      "Answers the question with minor drift or padding.",
      "Direct, well-scoped answer with fitting detail.",
      "Precise answer that anticipates the natural follow-up."),
    d("specificity", "Specificity", "具体程度",
      "Concrete detail over generalities?",
      "Pure generalities with no concrete detail at all.",
      "One concrete detail; everything else is generic.",
      "Several concrete details; personal role partly clear.",
      "Concrete first-person account with context and constraints.",
      "Rich, verifiable detail (metrics, trade-offs, dates)."),
    d("depth", "Depth", "回答深度",
      "Beyond surface level?",
      "Surface-level remarks only, no elaboration.",
      "One level of elaboration, then stalls.",
      "Solid working depth across the answer.",
      "Mechanism-level depth with clear reasoning chains.",
      "Expert depth: internals, limits, and trade-offs stated."),
    d("communication", "Communication", "表达沟通",
      "Role-relevant clarity and structure?",
      "Incoherent or off-topic delivery.",
      "Hard to follow; key terms left undefined.",
      "Followable with minor gaps or detours.",
      "Clear, structured, easy to verify.",
      "Exemplary, audience-aware communication."),
  ],
};

export const RUBRICS: Record<string, Rubric> = {
  [behavioralRubric.id]: behavioralRubric,
  [technicalRubric.id]: technicalRubric,
  [systemDesignRubric.id]: systemDesignRubric,
  [dataMlRubric.id]: dataMlRubric,
  [generalRubric.id]: generalRubric,
};

/** Framework/company strings (setup + legacy) → rubric id. */
export function selectRubricId(framework?: string): string {
  const f = (framework || "").toLowerCase();
  if (f === "star" || f === "behavioral" || f === "amazon_lps" || f === "google_googliness" || f === "startup_scrappiness") {
    return behavioralRubric.id;
  }
  if (f === "technical" || f === "coding" || f === "code") return technicalRubric.id;
  if (f === "system-design" || f === "system_design" || f === "systemdesign") return systemDesignRubric.id;
  if (f === "data" || f === "ml" || f === "data-ml" || f === "data_ml" || f === "data-science" || f === "data_science") {
    return dataMlRubric.id;
  }
  return generalRubric.id;
}

/** Deterministic UI mapping. The model emits 1-5 only. */
export function anchorToScore100(score: number): number {
  const clamped = Math.min(5, Math.max(1, Math.round(score)));
  return clamped * 20;
}
