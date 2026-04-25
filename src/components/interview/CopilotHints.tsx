"use client";

import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Lightbulb } from "@phosphor-icons/react";

interface CopilotHintsProps {
  wpm: number;
  visionData: { eyeContact: number; posture: number; expression: number } | null;
  isRecording: boolean;
}

export const CopilotHints = React.memo(({ wpm, visionData, isRecording }: CopilotHintsProps) => {
  const [activeHint, setActiveHint] = useState<string | null>(null);

  useEffect(() => {
    if (!isRecording) {
      setActiveHint(null);
      return;
    }

    // Evaluate conditions every few seconds to prevent spam
    const interval = setInterval(() => {
      // 1. Check Vision Telemetry
      if (visionData) {
        if (visionData.eyeContact < 60) {
          setActiveHint("Tip: Try to look directly at the camera to maintain eye contact.");
          return;
        }
        if (visionData.posture < 60) {
          setActiveHint("Tip: Sit up straight and maintain an open posture.");
          return;
        }
      }

      // 2. Check WPM
      if (wpm > 160) {
        setActiveHint("Tip: Your pacing is a bit fast. Try to slow down slightly.");
        return;
      }
      if (wpm > 0 && wpm < 100) {
        setActiveHint("Tip: Your pacing is a bit slow. Try to speak more fluidly.");
        return;
      }

      // Clear hint if everything is good
      setActiveHint(null);
    }, 3000); // Check every 3 seconds

    return () => clearInterval(interval);
  }, [wpm, visionData, isRecording]);

  // Auto-hide hint after 5 seconds if not updated
  useEffect(() => {
    if (activeHint) {
      const timeout = setTimeout(() => {
        setActiveHint(null);
      }, 5000);
      return () => clearTimeout(timeout);
    }
  }, [activeHint]);

  return (
    <AnimatePresence>
      {activeHint && (
        <motion.div
          initial={{ opacity: 0, y: 10, scale: 0.98, filter: "blur(4px)" }}
          animate={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }}
          exit={{ opacity: 0, scale: 0.95, filter: "blur(4px)" }}
          transition={{ type: "spring", stiffness: 200, damping: 20 }}
          className="fixed top-24 right-8 z-50 pointer-events-none bg-white/60 border border-white/50 backdrop-blur-xl rounded-2xl p-4 shadow-[0_8px_24px_rgba(0,0,0,0.04),inset_0_1px_0_rgba(255,255,255,0.8)] relative overflow-hidden group"
        >
          {/* Shimmer Effect */}
          <motion.div
            initial={{ x: "-100%" }}
            animate={{ x: "100%" }}
            transition={{ repeat: Infinity, duration: 2.5, ease: "linear", repeatDelay: 1 }}
            className="absolute inset-0 z-0 bg-gradient-to-r from-transparent via-white/50 to-transparent pointer-events-none"
          />
          <div className="flex items-start gap-3 relative z-10">
            <div className="mt-0.5 bg-gradient-to-br from-sky-400 to-emerald-400 p-1.5 rounded-full shadow-[0_2px_8px_rgba(56,189,248,0.4)]">
              <Lightbulb className="w-3.5 h-3.5 text-white" weight="fill" />
            </div>
            <div>
              <h4 className="text-[11px] font-bold text-amber-600 uppercase tracking-wider mb-0.5">AI Coach</h4>
              <p className="text-[13px] text-slate-700 font-medium leading-tight">
                {activeHint}
              </p>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
});

CopilotHints.displayName = "CopilotHints";
