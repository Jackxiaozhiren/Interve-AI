"use client";

import React from "react";
import { motion, AnimatePresence } from "framer-motion";

export type AIExpert = 'tech' | 'hr' | 'product' | 'system';

interface MultiAgentVisualizerProps {
  isSpeaking: boolean;
  isLoading: boolean;
  statusText?: string;
  stressTest?: boolean;
  wpm?: number;
  isCalmMode?: boolean;
  activeExpert: AIExpert;
}

export const MultiAgentVisualizer = React.memo(({ isSpeaking, isLoading, statusText, stressTest = false, wpm = 0, isCalmMode = false, activeExpert }: MultiAgentVisualizerProps) => {
  // Phase 30: AI Empathy (Pacing)
  const isAnxious = wpm > 150;
  const animMultiplier = isCalmMode ? 2 : (isAnxious ? 1.5 : 1);
  const speakingDuration = 2.5 * animMultiplier;
  const idleDuration = 8 * animMultiplier;

  const experts = [
    {
      id: 'tech',
      name: 'Tech Lead',
      baseColor: stressTest ? "from-rose-500 to-red-400" : "from-blue-500 to-cyan-400",
      glowColor: stressTest ? "bg-rose-500/40" : "bg-blue-500/40",
      coreColor: stressTest ? "bg-red-500" : "bg-cyan-400"
    },
    {
      id: 'hr',
      name: 'HR Director',
      baseColor: stressTest ? "from-orange-500 to-amber-400" : "from-purple-500 to-fuchsia-400",
      glowColor: stressTest ? "bg-orange-500/40" : "bg-purple-500/40",
      coreColor: stressTest ? "bg-amber-500" : "bg-fuchsia-400"
    },
    {
      id: 'product',
      name: 'Product Manager',
      baseColor: stressTest ? "from-red-500 to-rose-400" : "from-amber-500 to-yellow-400",
      glowColor: stressTest ? "bg-red-500/40" : "bg-amber-500/40",
      coreColor: stressTest ? "bg-rose-500" : "bg-yellow-400"
    }
  ];

  return (
    <div className="flex flex-col items-center justify-center w-full z-10 h-full relative p-4">
      {/* SVG filter for gooey "liquid" effect */}
      {!isCalmMode && (
        <svg className="hidden">
          <defs>
            <filter id="gooey">
              <feGaussianBlur in="SourceGraphic" stdDeviation="8" result="blur" />
              <feColorMatrix in="blur" mode="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 18 -7" result="goo" />
              <feComposite in="SourceGraphic" in2="goo" operator="atop" />
            </filter>
          </defs>
        </svg>
      )}

      <div className="flex flex-row items-center justify-center gap-8 md:gap-12 w-full max-w-2xl h-48">
        {experts.map((expert) => {
          const isActive = activeExpert === expert.id || (activeExpert === 'system' && expert.id === 'tech'); // Default to tech if system
          const actuallySpeaking = isActive && isSpeaking;
          const actuallyLoading = isActive && isLoading;

          return (
            <div key={expert.id} className="relative flex flex-col items-center justify-center gap-6">
              <div className="relative flex items-center justify-center w-24 h-24 md:w-32 md:h-32">
                {/* Outer ambient glow */}
                {!isCalmMode && isActive && (
                  <motion.div
                    animate={{
                      scale: actuallySpeaking ? [1, 1.3, 1] : [1, 1.1, 1],
                      opacity: actuallySpeaking ? [0.6, 0.9, 0.6] : [0.2, 0.4, 0.2],
                      filter: actuallySpeaking ? ["blur(15px)", "blur(25px)", "blur(15px)"] : ["blur(10px)", "blur(15px)", "blur(10px)"]
                    }}
                    transition={{ duration: actuallySpeaking ? speakingDuration : idleDuration, repeat: Infinity, ease: "easeInOut" }}
                    className={`absolute w-full h-full ${expert.glowColor} rounded-full mix-blend-screen`}
                  />
                )}

                {/* Liquid Glass Container (uses gooey filter) */}
                <div className="absolute inset-0 flex items-center justify-center" style={!isCalmMode && isActive ? { filter: "url(#gooey)" } : {}}>
                  {/* Main morphing body */}
                  <motion.div
                    animate={{
                      scale: isActive ? (actuallySpeaking ? [1, 1.15, 1] : [1, 1.05, 1]) : 0.8,
                      opacity: isActive ? 0.9 : 0.3,
                      rotate: actuallySpeaking ? (isCalmMode ? 0 : [0, 180, 360]) : 0,
                      borderRadius: actuallySpeaking && !isCalmMode
                        ? ["60% 40% 30% 70%/60% 30% 70% 40%", "30% 70% 70% 30%/30% 30% 70% 70%", "60% 40% 30% 70%/60% 30% 70% 40%"] 
                        : "50%"
                    }}
                    transition={{ duration: actuallySpeaking ? speakingDuration : idleDuration, repeat: Infinity, ease: "linear" }}
                    className={`absolute w-20 h-20 md:w-24 md:h-24 bg-gradient-to-tr ${expert.baseColor} ${isCalmMode || !isActive ? 'rounded-full' : ''} shadow-lg`}
                  />

                  {/* Orbiting blobs for liquid effect (disabled in calm mode and when inactive) */}
                  {!isCalmMode && isActive && [...Array(2)].map((_, i) => (
                    <motion.div
                      key={i}
                      animate={{
                        rotate: actuallySpeaking ? [0, 360] : [0, 180],
                        scale: actuallySpeaking ? [1, 1.2, 1] : [1, 1.05, 1],
                      }}
                      transition={{ 
                        rotate: { duration: (3 + i) * animMultiplier, repeat: Infinity, ease: "linear" },
                        scale: { duration: 2 * animMultiplier, repeat: Infinity, ease: "easeInOut", delay: i * 0.5 }
                      }}
                      className="absolute w-full h-full flex items-center justify-center"
                    >
                      <div 
                        className={`w-10 h-10 rounded-full bg-gradient-to-br ${expert.baseColor} opacity-90`}
                        style={{ transform: `translateY(${actuallySpeaking ? -30 : -20}px)` }}
                      />
                    </motion.div>
                  ))}
                </div>

                {/* Center core (Glass overlay) */}
                <motion.div
                  animate={{
                    scale: isActive ? (actuallySpeaking ? [1, 1.05, 1] : 1) : 0.8,
                  }}
                  transition={{ duration: actuallySpeaking ? 1.5 * animMultiplier : 4 * animMultiplier, repeat: Infinity, ease: "easeInOut" }}
                  className="absolute w-14 h-14 md:w-16 md:h-16 bg-white/20 backdrop-blur-md rounded-full border border-white/40 shadow-[0_4px_16px_rgba(255,255,255,0.1),inset_0_2px_4px_rgba(255,255,255,0.5)] flex items-center justify-center overflow-hidden"
                >
                  <div className="absolute inset-0 bg-gradient-to-br from-white/40 to-transparent rounded-full opacity-60" />
                  
                  <div className="relative z-10">
                    {actuallyLoading ? (
                      <div className="w-5 h-5 border-2 border-white/80 border-t-white rounded-full animate-spin shadow-sm" />
                    ) : isActive ? (
                      <div className="flex items-center justify-center gap-1 h-5">
                        {[...Array(3)].map((_, i) => (
                          <motion.div
                            key={i}
                            animate={{
                              height: actuallySpeaking ? [4, [10, 14, 10][i], 4] : 4,
                              opacity: actuallySpeaking ? 1 : 0.6
                            }}
                            transition={{
                              duration: actuallySpeaking ? ([0.4, 0.5, 0.45][i] * animMultiplier) : 2 * animMultiplier,
                              repeat: Infinity,
                              ease: "easeInOut",
                              delay: i * 0.1
                            }}
                            className={`w-1 rounded-full ${expert.coreColor} shadow-sm`}
                          />
                        ))}
                      </div>
                    ) : (
                      <div className="w-2 h-2 rounded-full bg-white/50" />
                    )}
                  </div>
                </motion.div>
              </div>

              {/* Speaker Label */}
              <motion.div
                animate={{
                  opacity: isActive ? 1 : 0.4,
                  y: isActive ? 0 : 2,
                  scale: isActive ? 1.05 : 1
                }}
                className={`text-xs md:text-sm font-semibold tracking-wide px-3 py-1 rounded-full border shadow-sm
                  ${isActive ? 'bg-white/80 backdrop-blur-md text-slate-800 border-white shadow-sm' : 'bg-transparent text-slate-500 border-transparent'}`}
              >
                {expert.name}
              </motion.div>
            </div>
          );
        })}
      </div>

      <div className="h-6 mt-6">
        <AnimatePresence mode="wait">
          <motion.span 
            key={statusText || "active"}
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -5 }}
            className={`text-[13px] font-medium tracking-wide bg-white/60 backdrop-blur-md px-4 py-1.5 rounded-full border shadow-sm
              ${stressTest ? 'text-rose-600 border-rose-100/80' : 'text-slate-500 border-white/80'}`
            }
          >
            {statusText || (isSpeaking ? "正在倾听..." : "准备就绪")}
          </motion.span>
        </AnimatePresence>
      </div>
    </div>
  );
});

MultiAgentVisualizer.displayName = 'MultiAgentVisualizer';
