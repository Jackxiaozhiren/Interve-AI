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
    <div className="w-full flex items-center justify-between px-6 py-4 bg-white/40 backdrop-blur-2xl rounded-[24px] border border-white/60 shadow-[0_8px_32px_rgba(0,0,0,0.02)] mb-4">
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
                  className="absolute left-0 top-3 h-[2px] -z-10 -translate-x-1/2 bg-sky-500 origin-left" 
                />
             )}
             
             <div className="flex flex-col items-center gap-2 relative z-10">
                <motion.div 
                  initial={false}
                  animate={{ 
                    scale: isActive ? 1.2 : 1,
                    backgroundColor: isActive ? '#0ea5e9' : isPast ? '#0ea5e9' : '#f1f5f9',
                    color: isActive || isPast ? '#ffffff' : '#94a3b8',
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
                <span className={`text-[11px] font-semibold transition-colors duration-300 ${isActive ? 'text-sky-600' : isPast ? 'text-slate-600' : 'text-slate-400'}`}>
                  {stage.label}
                </span>
             </div>
          </div>
        );
      })}
    </div>
  );
}
