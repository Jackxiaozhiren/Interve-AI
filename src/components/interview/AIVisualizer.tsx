"use client";

import React from "react";
import { motion, AnimatePresence, useMotionValue, useTransform, useSpring } from "framer-motion";

interface AIVisualizerProps {
  isSpeaking: boolean;
  isLoading: boolean;
  statusText?: string;
  stressTest?: boolean;
  wpm?: number;
  isCalmMode?: boolean;
}

export const AIVisualizer = React.memo(({ isSpeaking, isLoading, statusText, stressTest = false, wpm = 0, isCalmMode = false }: AIVisualizerProps) => {
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (isCalmMode) return; // Disable interactive movement in calm mode
    const { clientX, clientY, currentTarget } = e;
    const { left, top, width, height } = currentTarget.getBoundingClientRect();
    const x = clientX - (left + width / 2);
    const y = clientY - (top + height / 2);
    mouseX.set(x);
    mouseY.set(y);
  };

  const handleMouseLeave = () => {
    mouseX.set(0);
    mouseY.set(0);
  };

  const springConfig = { damping: 25, stiffness: 150 };
  const avatarX = useSpring(useTransform(mouseX, [-300, 300], [-30, 30]), springConfig);
  const avatarY = useSpring(useTransform(mouseY, [-300, 300], [-30, 30]), springConfig);

  // Define themes based on mode and stress test
  let baseColor = stressTest ? "from-rose-400 to-orange-300" : "from-sky-400 to-emerald-300";
  let glowColor = stressTest ? "bg-rose-200/50" : "bg-sky-200/50";
  let coreColor = stressTest ? "bg-rose-500" : "bg-sky-500";

  if (isCalmMode) {
    baseColor = "from-slate-200 to-slate-300";
    glowColor = "bg-slate-100/30";
    coreColor = "bg-slate-400";
  }

  // Phase 30: AI Empathy (Pacing)
  // If the user is speaking too fast (e.g., > 150 WPM), subtly slow down the visualizer to calm them
  const isAnxious = wpm > 150;
  const animMultiplier = isCalmMode ? 2 : (isAnxious ? 1.5 : 1);
  const speakingDuration = 2.5 * animMultiplier;
  const idleDuration = 8 * animMultiplier;
  const glowSpeakingDur = 2 * animMultiplier;
  const glowIdleDur = 4 * animMultiplier;

  return (
    <div 
      className="flex flex-col items-center justify-center gap-10 w-full z-10 h-full relative"
      onMouseMove={handleMouseMove} 
      onMouseLeave={handleMouseLeave}
    >
      {/* SVG filter for gooey "liquid" effect */}
      {!isCalmMode && (
        <svg className="hidden">
          <defs>
            <filter id="gooey">
              <feGaussianBlur in="SourceGraphic" stdDeviation="10" result="blur" />
              <feColorMatrix in="blur" mode="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 18 -7" result="goo" />
              <feComposite in="SourceGraphic" in2="goo" operator="atop" />
            </filter>
          </defs>
        </svg>
      )}

      <motion.div 
        style={{ x: avatarX, y: avatarY }}
        className="relative flex items-center justify-center h-56 w-full max-w-[280px]"
      >
        {/* Outer ambient glow */}
        {!isCalmMode && (
          <motion.div
            animate={{
              scale: isSpeaking ? [1, 1.2, 1] : [1, 1.05, 1],
              opacity: isSpeaking ? [0.6, 0.8, 0.6] : [0.3, 0.5, 0.3],
              filter: isSpeaking ? ["blur(20px)", "blur(30px)", "blur(20px)"] : ["blur(15px)", "blur(25px)", "blur(15px)"]
            }}
            transition={{ duration: isSpeaking ? glowSpeakingDur : glowIdleDur, repeat: Infinity, ease: "easeInOut" }}
            className={`absolute w-40 h-40 ${glowColor} rounded-full mix-blend-multiply`}
          />
        )}

        {/* Liquid Glass Container (uses gooey filter) */}
        <div className="absolute inset-0 flex items-center justify-center" style={!isCalmMode ? { filter: "url(#gooey)" } : {}}>
          {/* Main morphing body */}
          <motion.div
            animate={{
              scale: isSpeaking ? [1, 1.15, 1] : [1, 1.02, 1],
              rotate: isSpeaking ? (isCalmMode ? 0 : [0, 180, 360]) : (isCalmMode ? 0 : [0, 90, 180]),
              borderRadius: isSpeaking && !isCalmMode
                ? ["60% 40% 30% 70%/60% 30% 70% 40%", "30% 70% 70% 30%/30% 30% 70% 70%", "60% 40% 30% 70%/60% 30% 70% 40%"] 
                : ["50% 50% 50% 50%", "45% 55% 45% 55%/55% 45% 55% 45%", "50% 50% 50% 50%"]
            }}
            transition={{ duration: isSpeaking ? speakingDuration : idleDuration, repeat: Infinity, ease: "linear" }}
            className={`absolute w-32 h-32 bg-gradient-to-tr ${baseColor} opacity-80 ${isCalmMode ? 'rounded-full' : ''}`}
          />

          {/* Orbiting blobs for liquid effect (disabled in calm mode) */}
          {!isCalmMode && [...Array(3)].map((_, i) => (
            <motion.div
              key={i}
              animate={{
                rotate: isSpeaking ? [0, 360] : [0, 180],
                scale: isSpeaking ? [1, 1.2, 1] : [1, 1.05, 1],
              }}
              transition={{ 
                rotate: { duration: (3 + i) * animMultiplier, repeat: Infinity, ease: "linear" },
                scale: { duration: 2 * animMultiplier, repeat: Infinity, ease: "easeInOut", delay: i * 0.5 }
              }}
              className="absolute w-full h-full flex items-center justify-center"
            >
              <div 
                className={`w-12 h-12 rounded-full bg-gradient-to-br ${baseColor} opacity-90`}
                style={{ transform: `translateY(${isSpeaking ? -45 : -35}px)` }}
              />
            </motion.div>
          ))}
        </div>

        {/* Center core (Glass overlay) */}
        <motion.div
          animate={{
            scale: isSpeaking ? [1, 1.05, 1] : [1, 1.01, 1],
            rotate: isSpeaking && !isCalmMode ? [-5, 5, -5] : [-2, 2, -2]
          }}
          transition={{ duration: isSpeaking ? 1.5 * animMultiplier : 4 * animMultiplier, repeat: Infinity, ease: "easeInOut" }}
          className="absolute w-20 h-20 bg-white/30 backdrop-blur-md rounded-full border border-white/60 shadow-[0_8px_32px_rgba(255,255,255,0.2),inset_0_2px_4px_rgba(255,255,255,0.8)] flex items-center justify-center overflow-hidden"
        >
          {/* Inner reflection */}
          <div className="absolute inset-0 bg-gradient-to-br from-white/60 to-transparent rounded-full opacity-80" />
          
          <div className="relative z-10">
            {isLoading ? (
              <div className="w-6 h-6 border-2 border-white/80 border-t-white rounded-full animate-spin shadow-sm" />
            ) : (
              <div className="flex items-center justify-center gap-1 h-6">
                {[...Array(4)].map((_, i) => (
                  <motion.div
                    key={i}
                    animate={{
                      height: isSpeaking ? [4, [10, 16, 12, 18][i], 4] : 4,
                      opacity: isSpeaking ? 1 : 0.6
                    }}
                    transition={{
                      duration: isSpeaking ? ([0.4, 0.5, 0.45, 0.6][i] * animMultiplier) : 2 * animMultiplier,
                      repeat: Infinity,
                      ease: "easeInOut",
                      delay: i * 0.1
                    }}
                    className={`w-1 rounded-full ${coreColor} shadow-sm`}
                  />
                ))}
              </div>
            )}
          </div>
        </motion.div>
      </motion.div>

      <div className="h-6">
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

AIVisualizer.displayName = 'AIVisualizer';
