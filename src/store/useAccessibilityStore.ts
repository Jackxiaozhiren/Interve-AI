import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface AccessibilityState {
  isCalmMode: boolean;
  isLiveCaptionsEnabled: boolean;
  isDyslexiaMode: boolean;
  // Phase 9: AI-estimated tiles (STAR/behavior/strain) are hidden by
  // default during live interviews to reduce score distraction (UX 21).
  // Scores belong to the post-interview report.
  showLiveInsights: boolean;
  toggleCalmMode: () => void;
  setCalmMode: (value: boolean) => void;
  toggleLiveCaptions: () => void;
  toggleDyslexiaMode: () => void;
  setDyslexiaMode: (value: boolean) => void;
  toggleLiveInsights: () => void;
}

export const useAccessibilityStore = create<AccessibilityState>()(
  persist(
    (set) => ({
      isCalmMode: false,
      isLiveCaptionsEnabled: false,
      isDyslexiaMode: false,
      showLiveInsights: false,
      toggleCalmMode: () => set((state) => ({ isCalmMode: !state.isCalmMode })),
      setCalmMode: (value) => set({ isCalmMode: value }),
      toggleLiveCaptions: () => set((state) => ({ isLiveCaptionsEnabled: !state.isLiveCaptionsEnabled })),
      toggleDyslexiaMode: () => set((state) => ({ isDyslexiaMode: !state.isDyslexiaMode })),
      setDyslexiaMode: (value) => set({ isDyslexiaMode: value }),
      toggleLiveInsights: () => set((state) => ({ showLiveInsights: !state.showLiveInsights })),
    }),
    {
      name: 'accessibility-storage',
    }
  )
);
