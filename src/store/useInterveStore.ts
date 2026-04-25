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
  
  setJobDescription: (jd: string) => void;
  setResumeText: (text: string) => void;
  setCheatsheet: (cheatsheet: string[] | null) => void;
  setTopPredictions: (predictions: TopPrediction[] | null) => void;
  setIsProcessing: (isProcessing: boolean) => void;
  setCurrentInterviewId: (id: number | null) => void;
  setCognitiveLoad: (load: number | ((prev: number) => number)) => void;
  setStarProgress: (progress: Partial<StarProgress> | ((prev: StarProgress) => Partial<StarProgress>)) => void;
  setBehavioralTraits: (traits: Partial<BehavioralTraits> | ((prev: BehavioralTraits) => Partial<BehavioralTraits>)) => void;
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
  }),
}));
