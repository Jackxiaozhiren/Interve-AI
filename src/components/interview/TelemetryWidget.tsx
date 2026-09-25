"use client";

import React from "react";
import { motion } from "framer-motion";
import { Brain, Microphone, Waveform } from "@phosphor-icons/react";

interface TelemetryWidgetProps {
  isRecording?: boolean;
  isAiSpeaking?: boolean;
}

// Phase 3 (Truthfulness Reset): the "Focus.Idx" tile showed an unseeded
// random walk labeled as a cognitive metric. Removed. This widget now
// reports only the real audio pipeline state.
export function TelemetryWidget({ isRecording, isAiSpeaking }: TelemetryWidgetProps) {
  return (
    <div className="flex flex-col gap-3 w-full h-full">
      <div className="flex items-center justify-between px-2">
        {/* Phase 14: slate-700/500 for 4.5:1 on glass (were 600/400). */}
        <div className="flex items-center gap-1.5 text-slate-700">
          <Brain weight="bold" className="w-4 h-4 text-sky-500" />
          <span className="text-[10px] font-bold tracking-widest uppercase font-sans text-slate-700">Session</span>
        </div>
      </div>
      
      <div className="grid grid-cols-1 gap-3 flex-1">
        {/* Status Tile */}
        <motion.div 
          whileHover={{ y: -4, scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          transition={{ type: "spring", stiffness: 400, damping: 30 }}
          role="region"
          aria-label="Agent Audio Status"
          className="flex flex-col p-4 glass-card rounded-2xl relative overflow-hidden group justify-between"
        >
          <div className="flex items-center justify-between z-10">
            <span className="text-[10px] text-slate-600 font-bold font-sans uppercase tracking-wider">Status</span>
          </div>
          <div className="flex flex-col items-center justify-center h-full z-10 mt-2">
            <div className="flex items-center justify-center w-10 h-10 rounded-full bg-white/60 shadow-sm border border-white/80 mb-2">
              {isAiSpeaking ? (
                <Waveform className="w-5 h-5 text-emerald-500 animate-pulse" weight="bold" />
              ) : isRecording ? (
                <Microphone className="w-5 h-5 text-sky-500 animate-pulse" weight="bold" />
              ) : (
                <div className="w-3 h-3 rounded-full bg-slate-300" />
              )}
            </div>
            <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wide">
              {isAiSpeaking ? "AI Active" : isRecording ? "Listening" : "Standby"}
            </span>
            <span className="text-[9px] text-slate-600 font-medium mt-1">Audio pipeline state</span>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
