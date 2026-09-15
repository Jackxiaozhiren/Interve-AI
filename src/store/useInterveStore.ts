import { create } from 'zustand';

export interface TopPrediction {
  question: string;
  rationale: string;
  keyPointsToHit: string[];
}

export interface StarComponent {
  progress: number; // 0-100
  confidence: number; // 0-100
  timeSpentSeconds: number;
}

export interface StarProgress {
  s: StarComponent;
  t: StarComponent;
  a: StarComponent;
  r: StarComponent;
}

export interface BehavioralTraits {
  leadership: number; // 0-100
  problemSolving: number; // 0-100
  communication: number; // 0-100
}

/** Evaluator confidence = evidence sufficiency, never candidate psychology.
 * Mirrors the server envelope (src/ai/evidence.ts); defined here (not
 * imported) so client components never pull zod into their bundle. */
export type EvaluatorConfidence = "high" | "medium" | "low";

/**
 * Client-side grounding normalizer (steering envelope, EVALUATION_V2 §7).
 * Fetch JSON is untrusted: keep string quotes (capped), fall back to
 * "medium" for anything but the enum, never throw — steering display
 * must survive a malformed envelope.
 */
export function normalizeGrounding(input: unknown, max: number): { evidence: string[]; confidence: EvaluatorConfidence } {
  if (typeof input !== "object" || input === null) return { evidence: [], confidence: "medium" };
  const o = input as Record<string, unknown>;
  const evidence = Array.isArray(o.evidence)
    ? (o.evidence as unknown[]).filter((q): q is string => typeof q === "string" && q.length > 0).slice(0, max)
    : [];
  const confidence: EvaluatorConfidence =
    o.confidence === "high" || o.confidence === "low" ? o.confidence : "medium";
  return { evidence, confidence };
}

interface InterveState {
  jobDescription: string;
  resumeText: string;
  cheatsheet: string[] | null;
  topPredictions: TopPrediction[] | null;
  isProcessing: boolean;
  currentInterviewId: number | null;
  cognitiveLoad: number; // 0 to 100, where higher is more stressed
  starProgress: StarProgress;
  behavioralTraits: BehavioralTraits;
  // Steering-envelope grounding (EVALUATION_V2 §7): latest verbatim quotes
  // + evaluator confidence behind the live numbers. Replaced per analyzer
  // call (quotes are per-answer, unlike the max-accumulated numbers).
  starEvidence: string[];
  starConfidence: EvaluatorConfidence;
  traitsEvidence: string[];
  traitsConfidence: EvaluatorConfidence;
  
  setJobDescription: (jd: string) => void;
  setResumeText: (text: string) => void;
  setCheatsheet: (cheatsheet: string[] | null) => void;
  setTopPredictions: (predictions: TopPrediction[] | null) => void;
  setIsProcessing: (isProcessing: boolean) => void;
  setCurrentInterviewId: (id: number | null) => void;
  setCognitiveLoad: (load: number | ((prev: number) => number)) => void;
  setStarProgress: (progress: Partial<StarProgress> | ((prev: StarProgress) => Partial<StarProgress>)) => void;
  setBehavioralTraits: (traits: Partial<BehavioralTraits> | ((prev: BehavioralTraits) => Partial<BehavioralTraits>)) => void;
  setStarGrounding: (evidence: string[], confidence: EvaluatorConfidence) => void;
  setTraitsGrounding: (evidence: string[], confidence: EvaluatorConfidence) => void;
  reset: () => void;
}

export const useInterveStore = create<InterveState>((set) => ({
  jobDescription: '',
  resumeText: '',
  cheatsheet: null,
  topPredictions: null,
  isProcessing: false,
  currentInterviewId: null,
  cognitiveLoad: 0,
  starProgress: { 
    s: { progress: 0, confidence: 0, timeSpentSeconds: 0 }, 
    t: { progress: 0, confidence: 0, timeSpentSeconds: 0 }, 
    a: { progress: 0, confidence: 0, timeSpentSeconds: 0 }, 
    r: { progress: 0, confidence: 0, timeSpentSeconds: 0 } 
  },
  behavioralTraits: { leadership: 0, problemSolving: 0, communication: 0 },
  starEvidence: [],
  starConfidence: "medium",
  traitsEvidence: [],
  traitsConfidence: "medium",
  
  setJobDescription: (jd) => set({ jobDescription: jd }),
  setResumeText: (text) => set({ resumeText: text }),
  setCheatsheet: (cheatsheet) => set({ cheatsheet }),
  setTopPredictions: (predictions) => set({ topPredictions: predictions }),
  setIsProcessing: (isProcessing) => set({ isProcessing }),
  setCurrentInterviewId: (id) => set({ currentInterviewId: id }),
  setCognitiveLoad: (load) => set((state) => ({ 
    cognitiveLoad: typeof load === 'function' ? load(state.cognitiveLoad) : load 
  })),
  setStarProgress: (progress) => set((state) => ({
    starProgress: {
      ...state.starProgress,
      ...(typeof progress === 'function' ? progress(state.starProgress) : progress)
    }
  })),
  setBehavioralTraits: (traits) => set((state) => ({
    behavioralTraits: {
      ...state.behavioralTraits,
      ...(typeof traits === 'function' ? traits(state.behavioralTraits) : traits)
    }
  })),
  setStarGrounding: (evidence, confidence) => set({ starEvidence: evidence, starConfidence: confidence }),
  setTraitsGrounding: (evidence, confidence) => set({ traitsEvidence: evidence, traitsConfidence: confidence }),
  reset: () => set({
    jobDescription: '',
    resumeText: '',
    cheatsheet: null,
    topPredictions: null,
    isProcessing: false,
    currentInterviewId: null,
    cognitiveLoad: 0,
    starProgress: { 
      s: { progress: 0, confidence: 0, timeSpentSeconds: 0 }, 
      t: { progress: 0, confidence: 0, timeSpentSeconds: 0 }, 
      a: { progress: 0, confidence: 0, timeSpentSeconds: 0 }, 
      r: { progress: 0, confidence: 0, timeSpentSeconds: 0 } 
    },
    // reset() previously leaked behavioralTraits across interviews; now
    // clears them with everything else (found while wiring §7 grounding).
    behavioralTraits: { leadership: 0, problemSolving: 0, communication: 0 },
    starEvidence: [],
    starConfidence: "medium",
    traitsEvidence: [],
    traitsConfidence: "medium",
  }),
}));
