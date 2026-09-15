"use client";

import { create } from "zustand";
import {
  initInterviewState,
  recordTurn,
  DIFFICULTIES,
  type Difficulty,
  type InterviewState,
  type StarSnapshot,
  type TraitsSnapshot,
} from "@/ai/interview/state";

interface InterviewLoopStore {
  loop: InterviewState | null;
  initLoop: (level?: string, opts?: { difficulty?: string; timeBudgetSec?: number }) => void;
  recordUserTurn: (question: string, signals?: {
    starProgress?: StarSnapshot | null;
    behavioralTraits?: TraitsSnapshot | null;
  }) => void;
  resetLoop: () => void;
}

/**
 * Client-side interview loop state (UI + per-message freshness).
 * Authority stays server-side (synthesizeServerState); this store drives
 * the turn counter / difficulty badge and the timing info sent each turn.
 */
export const useInterviewLoopStore = create<InterviewLoopStore>()((set, get) => ({
  loop: null,
  initLoop: (level, opts) => {
    const difficulty = (
      opts?.difficulty && (DIFFICULTIES as readonly string[]).includes(opts.difficulty)
        ? opts.difficulty
        : undefined
    ) as Difficulty | undefined;
    // Clamp untrusted URL input to sane bounds.
    const timeBudgetSec = typeof opts?.timeBudgetSec === "number" && Number.isFinite(opts.timeBudgetSec)
      ? Math.min(7200, Math.max(60, Math.round(opts.timeBudgetSec)))
      : undefined;
    const base = initInterviewState({ level });
    set({
      loop: {
        ...base,
        difficulty: difficulty ?? base.difficulty,
        timeBudgetSec: timeBudgetSec ?? base.timeBudgetSec,
      },
    });
  },
  recordUserTurn: (question, signals) => {
    const { loop } = get();
    if (!loop) return;
    set({
      loop: recordTurn(loop, {
        question,
        starProgress: signals?.starProgress ?? null,
        behavioralTraits: signals?.behavioralTraits ?? null,
      }),
    });
  },
  resetLoop: () => set({ loop: null }),
}));
