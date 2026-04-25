import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface AccessibilityState {
  isCalmMode: boolean;
  isLiveCaptionsEnabled: boolean;
  isDyslexiaMode: boolean;
  toggleCalmMode: () => void;
  setCalmMode: (value: boolean) => void;
  toggleLiveCaptions: () => void;
  toggleDyslexiaMode: () => void;
  setDyslexiaMode: (value: boolean) => void;
}

export const useAccessibilityStore = create<AccessibilityState>()(
  persist(
    (set) => ({
      isCalmMode: false,
      isLiveCaptionsEnabled: false,
      isDyslexiaMode: false,
      toggleCalmMode: () => set((state) => ({ isCalmMode: !state.isCalmMode })),
      setCalmMode: (value) => set({ isCalmMode: value }),
      toggleLiveCaptions: () => set((state) => ({ isLiveCaptionsEnabled: !state.isLiveCaptionsEnabled })),
      toggleDyslexiaMode: () => set((state) => ({ isDyslexiaMode: !state.isDyslexiaMode })),
      setDyslexiaMode: (value) => set({ isDyslexiaMode: value }),
    }),
    {
      name: 'accessibility-storage',
    }
  )
);
