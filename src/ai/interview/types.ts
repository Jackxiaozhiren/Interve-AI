// Phase 7: canonical interview-type taxonomy (12.2).
//
// Eleven entries per the product spec. Each maps to an EXISTING rubric —
// no new scoring experiences are invented here; deep type-specific tracks
// (multi-language execution, continuous whiteboard vision) are explicitly
// deferred (see PRODUCT_LOOP_REPORT). `custom` carries free text.

export interface InterviewTypeDef {
  id: string;
  name: string;
  nameZh: string;
  description: string;
  /** Rubric used for final evaluation. */
  rubricId: "behavioral-v1" | "technical-v1" | "system-design-v1" | "data-ml-v1" | "general-v1";
  needsCoding: boolean;
  needsWhiteboard: boolean;
}

export const INTERVIEW_TYPES: InterviewTypeDef[] = [
  { id: "recruiter-screen", name: "Recruiter Screen", nameZh: "HR 初筛", description: "Motivation, background fit, logistics, salary expectations.", rubricId: "general-v1", needsCoding: false, needsWhiteboard: false },
  { id: "behavioral", name: "Behavioral", nameZh: "行为面试", description: "Past-experience stories, STAR structure, ownership and impact.", rubricId: "behavioral-v1", needsCoding: false, needsWhiteboard: false },
  { id: "technical", name: "Technical Knowledge", nameZh: "技术知识", description: "Domain fundamentals, correctness, trade-offs, depth.", rubricId: "technical-v1", needsCoding: false, needsWhiteboard: false },
  { id: "coding", name: "Coding", nameZh: "编程实战", description: "Live problem solving with code, complexity, and testing.", rubricId: "technical-v1", needsCoding: true, needsWhiteboard: false },
  { id: "system-design", name: "System Design", nameZh: "系统设计", description: "Architecture, scalability, reliability, trade-offs on the whiteboard.", rubricId: "system-design-v1", needsCoding: false, needsWhiteboard: true },
  { id: "data-ml", name: "Data / ML", nameZh: "数据与机器学习", description: "Framing, data assumptions, modeling, evaluation, deployment.", rubricId: "data-ml-v1", needsCoding: false, needsWhiteboard: false },
  { id: "product-case", name: "Product Case", nameZh: "产品案例", description: "Ambiguous product problems, metrics, prioritization.", rubricId: "general-v1", needsCoding: false, needsWhiteboard: false },
  { id: "business-case", name: "Business Case", nameZh: "商业案例", description: "Market sizing, strategy, structured business reasoning.", rubricId: "general-v1", needsCoding: false, needsWhiteboard: false },
  { id: "salary-negotiation", name: "Salary Negotiation", nameZh: "薪资谈判", description: "Offers, trade-offs, and negotiation practice.", rubricId: "general-v1", needsCoding: false, needsWhiteboard: false },
  { id: "leadership", name: "Leadership", nameZh: "领导力", description: "Leading through ambiguity, conflict, and ownership at scope.", rubricId: "behavioral-v1", needsCoding: false, needsWhiteboard: false },
  { id: "custom", name: "Custom", nameZh: "自定义", description: "Free-form focus described by the candidate.", rubricId: "general-v1", needsCoding: false, needsWhiteboard: false },
];

export const INTERVIEW_TYPE_VERSION = "1.0.0";

export function getInterviewType(id?: string): InterviewTypeDef {
  return INTERVIEW_TYPES.find((t) => t.id === id) ?? INTERVIEW_TYPES[0];
}
