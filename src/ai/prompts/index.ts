// Phase 5 prompt registry index: every versioned prompt in one place.
// Uniqueness + semver shape are pinned by registry tests.
import { INTERVIEW_PROMPT_ID, INTERVIEW_PROMPT_VERSION } from "./interview";
import { STAR_PROMPT_ID, STAR_PROMPT_VERSION } from "./star";
import { BEHAVIOR_PROMPT_ID, BEHAVIOR_PROMPT_VERSION } from "./behavior";
import { CHUNK_PROMPT_ID, CHUNK_PROMPT_VERSION } from "./chunk";
import { CODE_PROMPT_ID, CODE_PROMPT_VERSION } from "./code";
import { PRACTICE_PROMPT_ID, PRACTICE_PROMPT_VERSION } from "./practice";
import { ALIGNMENT_PROMPT_ID, ALIGNMENT_PROMPT_VERSION } from "./alignment";
import { MATCH_PROMPT_ID, MATCH_PROMPT_VERSION } from "./match";
import { JD_PROMPT_ID, JD_PROMPT_VERSION } from "./jd";
import { CONTEXT_PROMPT_ID, CONTEXT_PROMPT_VERSION } from "./context";
import { COPILOT_PROMPT_ID, COPILOT_PROMPT_VERSION } from "./copilot";
import { HINT_PROMPT_ID, HINT_PROMPT_VERSION } from "./hint";
import { VISION_PROMPT_ID, VISION_PROMPT_VERSION } from "./vision";
import { TRENDS_PROMPT_ID, TRENDS_PROMPT_VERSION } from "./trends";
import { RESUME_PROMPT_ID, RESUME_PROMPT_VERSION } from "./resume";
import { COVERAGE_PROMPT_ID, COVERAGE_PROMPT_VERSION } from "./coverage";
import { EVALUATION_VERSION } from "../evaluation-contract";

export interface PromptRegistration {
  id: string;
  version: string;
}

/** interview evaluation prompt is owned by evaluation-contract (v2.0). */
export const PROMPT_REGISTRY: PromptRegistration[] = [
  { id: INTERVIEW_PROMPT_ID, version: INTERVIEW_PROMPT_VERSION },
  { id: STAR_PROMPT_ID, version: STAR_PROMPT_VERSION },
  { id: BEHAVIOR_PROMPT_ID, version: BEHAVIOR_PROMPT_VERSION },
  { id: CHUNK_PROMPT_ID, version: CHUNK_PROMPT_VERSION },
  { id: CODE_PROMPT_ID, version: CODE_PROMPT_VERSION },
  { id: PRACTICE_PROMPT_ID, version: PRACTICE_PROMPT_VERSION },
  { id: ALIGNMENT_PROMPT_ID, version: ALIGNMENT_PROMPT_VERSION },
  { id: MATCH_PROMPT_ID, version: MATCH_PROMPT_VERSION },
  { id: JD_PROMPT_ID, version: JD_PROMPT_VERSION },
  { id: CONTEXT_PROMPT_ID, version: CONTEXT_PROMPT_VERSION },
  { id: COPILOT_PROMPT_ID, version: COPILOT_PROMPT_VERSION },
  { id: HINT_PROMPT_ID, version: HINT_PROMPT_VERSION },
  { id: VISION_PROMPT_ID, version: VISION_PROMPT_VERSION },
  { id: TRENDS_PROMPT_ID, version: TRENDS_PROMPT_VERSION },
  { id: RESUME_PROMPT_ID, version: RESUME_PROMPT_VERSION },
  { id: COVERAGE_PROMPT_ID, version: COVERAGE_PROMPT_VERSION },
  { id: "evaluation-v2", version: EVALUATION_VERSION },
];
