"use client";

import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Microphone, Brain } from "@phosphor-icons/react";

interface SoftPacingBarProps {
  isRecording: boolean;
  recordingStartTime: number | null;
}

export const SoftPacingBar = ({ isRecording, recordingStartTime }: SoftPacingBarProps) => {
  const [durationSeconds, setDurationSeconds] = useState(0);

  useEffect(() => {
    if (!isRecording || !recordingStartTime) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setDurationSeconds(0);
      return;
    }

    const interval = setInterval(() => {
      setDurationSeconds(Math.floor((Date.now() - recordingStartTime) / 1000));
    }, 1000);

    return () => clearInterval(interval);
  }, [isRecording, recordingStartTime]);

  // Assume a 2-minute soft target for an ideal answer
  const softTargetSeconds = 120;
  
  // Calculate width percentage up to 100%
  const widthPercentage = Math.min((durationSeconds / softTargetSeconds) * 100, 100);

  return (
    <div className="flex items-center gap-3 bg-white/60 backdrop-blur-md px-3 py-1.5 rounded-full border border-white shadow-sm h-8">
      {/* Status Badge */}
      <div className="flex items-center gap-1.5 min-w-[90px]">
        {isRecording ? (
          <>
            <div className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
            <Microphone className="w-3.5 h-3.5 text-rose-500" />
            <span className="text-[12px] font-semibold text-rose-600">Your Turn</span>
          </>
        ) : (
          <>
            <div className="w-1.5 h-1.5 rounded-full bg-sky-500 animate-pulse" />
            <Brain className="w-3.5 h-3.5 text-sky-500" />
            <span className="text-[12px] font-semibold text-sky-600">AI is Thinking</span>
          </>
        )}
      </div>

      {/* Pacing Bar (Only visible when recording) */}
      <div 
        className={`relative h-1.5 rounded-full bg-slate-200/60 overflow-hidden transition-all duration-500 ${
          isRecording ? 'w-24 opacity-100' : 'w-0 opacity-0'
        }`}
      >
        <motion.div 
          className="absolute top-0 left-0 h-full bg-gradient-to-r from-rose-400 to-rose-300 rounded-full"
          initial={{ width: 0 }}
          animate={{ width: `${widthPercentage}%` }}
          transition={{ duration: 1, ease: "linear" }}
        />
      </div>
    </div>
  );
};
