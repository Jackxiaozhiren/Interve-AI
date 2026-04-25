import { create } from 'zustand';

interface AppState {
  isSidebarOpen: boolean;
  toggleSidebar: () => void;
  resumeText: string | null;
  jdText: string | null;
  cheatsheet: string | null;
  setResumeText: (text: string) => void;
  setJdText: (text: string) => void;
  setCheatsheet: (text: string) => void;
}

export const useAppStore = create<AppState>((set) => ({
  isSidebarOpen: true,
  toggleSidebar: () => set((state) => ({ isSidebarOpen: !state.isSidebarOpen })),
  resumeText: null,
  jdText: null,
  cheatsheet: null,
  setResumeText: (text) => set({ resumeText: text }),
  setJdText: (text) => set({ jdText: text }),
  setCheatsheet: (text) => set({ cheatsheet: text }),
}));
