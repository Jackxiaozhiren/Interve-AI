"use client";

import React from "react";
import { motion } from "framer-motion";

const stages = [
  { id: "intro", label: "Introduction", messagesThreshold: 0 },
  { id: "deep-dive", label: "Deep Dive", messagesThreshold: 4 },
  { id: "challenge", label: "Technical Challenge", messagesThreshold: 10 },
  { id: "qa", label: "Q&A", messagesThreshold: 16 },
  { id: "wrap-up", label: "Wrap-up", messagesThreshold: 20 },
];

interface FlowMapProps {
  messageCount: number;
}

export function FlowMap({ messageCount }: FlowMapProps) {
  let currentStageIndex = 0;
  for (let i = stages.length - 1; i >= 0; i--) {
    if (messageCount >= stages[i].messagesThreshold) {
      currentStageIndex = i;
      break;
    }
  }

  // Calculate progress percentage to smooth out the connecting line
  const nextThreshold = stages[currentStageIndex + 1]?.messagesThreshold || stages[currentStageIndex].messagesThreshold + 4;
  const currentThreshold = stages[currentStageIndex].messagesThreshold;
  const stageProgress = Math.min(1, Math.max(0, (messageCount - currentThreshold) / (nextThreshold - currentThreshold)));

  return (
    // `pointer-events-none`: this is a progress read-out with nothing to click, and
    // at 390 px its five 11 px labels overflowed their columns far enough to sit on
    // top of the send button — the click landed on "Wrap-up" and the interview could
    // not be advanced at all. The row is now transparent to the pointer and the
    // labels shrink to the active stage on a narrow screen, so nothing needs to be
    // clicked through it in the first place.
    <div className="w-full flex items-center justify-between px-6 py-4 bg-white/40 backdrop-blur-2xl rounded-[24px] border border-white/60 shadow-[0_8px_32px_rgba(0,0,0,0.02)] mb-4 pointer-events-none">
      {stages.map((stage, idx) => {
        const isActive = idx === currentStageIndex;
        const isPast = idx < currentStageIndex;
        
        return (
          <div key={stage.id} className="flex-1 flex flex-col relative">
             {/* Connecting Line - Background */}
             {idx !== 0 && (
                <div className="absolute left-0 top-3 h-[2px] w-full -z-20 -translate-x-1/2 bg-slate-200" />
             )}
             
             {/* Connecting Line - Active Fill */}
             {idx !== 0 && (
                <motion.div 
                  initial={false}
                  animate={{ 
                    width: isPast ? '100%' : isActive ? `${stageProgress * 100}%` : '0%' 
                  }}
                  className="absolute left-0 top-3 h-[2px] -z-10 -translate-x-1/2 bg-sky-700 origin-left" 
                />
             )}
             
              <div className="flex flex-col items-center gap-2 relative z-10">
                <motion.div
                  initial={false}
                  animate={{
                    scale: isActive ? 1.2 : 1,
                    backgroundColor: isActive ? '#0369a1' : isPast ? '#0369a1' : '#f1f5f9',
                    // 5.93:1 for the white digits on #0369a1, 6.92:1 for #475569 on
                    // the #f1f5f9 idle dot — both recomputed by
                    // tests/unit/flowmap-dot-contrast.test.ts, which reds this file if
                    // the numbers and the colours disagree. They replaced 2.77:1
                    // (white on sky-500) and 4.34:1 (slate-500 on slate-100, not on
                    // white — the comment here claimed 4.5:1 and nothing could
                    // contradict it, because axe refuses to judge a one-character
                    // node at all). sky-600 was tried and is still short.
                    color: isActive || isPast ? '#ffffff' : '#475569',
                    boxShadow: isActive ? '0 0 0 4px rgba(14, 165, 233, 0.2)' : '0 0 0 0px rgba(14, 165, 233, 0)'
                  }}
                  className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold border border-white/50"
                >
                  {isPast ? (
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    idx + 1
                  )}
                </motion.div>
                {/* Phase 14: active sky-700 (was sky-600, 4.02) and idle
                    slate-500 (was slate-400, 2.63) meet 4.5:1. */}
                <span
                  className={`text-[11px] font-semibold transition-colors duration-300 max-w-full truncate px-1 ${
                    isActive ? "text-sky-700" : "hidden sm:inline " + (isPast ? "text-slate-600" : "text-slate-500")
                  }`}
                >
                  {stage.label}
                </span>
              </div>
          </div>
        );
      })}
    </div>
  );
}
