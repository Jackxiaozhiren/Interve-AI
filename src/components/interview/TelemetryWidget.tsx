"use client";

import React, { useEffect, useState, useRef } from "react";
import { motion, animate } from "framer-motion";
import { Brain, Microphone, Waveform } from "@phosphor-icons/react";

function AnimatedNumber({ value, pad }: { value: number, pad: number }) {
  const nodeRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const node = nodeRef.current;
    if (node) {
      const controls = animate(Number(node.textContent) || 0, value, {
        duration: 0.5,
        type: "spring",
        bounce: 0.2,
        onUpdate(v) {
          node.textContent = Math.round(v).toString().padStart(pad, '0');
        }
      });
      return controls.stop;
    }
  }, [value, pad]);

  return <span ref={nodeRef}>{value.toString().padStart(pad, '0')}</span>;
}

interface TelemetryWidgetProps {
  isRecording?: boolean;
  isAiSpeaking?: boolean;
  wpm?: number;
}

export function TelemetryWidget({ isRecording, isAiSpeaking }: TelemetryWidgetProps) {
  const [focus, setFocus] = useState(95);

  // Mock real-time data fluctuations for focus
  useEffect(() => {
    const interval = setInterval(() => {
      setFocus((prev) => Math.max(70, Math.min(100, prev + (Math.random() * 4 - 2))));
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex flex-col gap-3 w-full h-full">
      <div className="flex items-center justify-between px-2">
        <div className="flex items-center gap-1.5 text-slate-500">
          <Brain weight="bold" className="w-4 h-4 text-sky-500" />
          <span className="text-[10px] font-bold tracking-widest uppercase font-sans text-slate-600">Cognitive</span>
        </div>
      </div>
      
      <div className="grid grid-cols-2 gap-3 flex-1">
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
            <span className="text-[10px] text-slate-500 font-bold font-sans uppercase tracking-wider">Status</span>
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
          </div>
        </motion.div>

        {/* Focus Tile */}
        <motion.div 
          whileHover={{ y: -4, scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          transition={{ type: "spring", stiffness: 400, damping: 30 }}
          role="region"
          aria-label="Cognitive Focus Index"
          className="flex flex-col p-4 glass-card rounded-2xl relative overflow-hidden group justify-between"
        >
          <motion.div 
            animate={{ opacity: [0.1, 0.2, 0.1] }}
            transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
            className="absolute inset-0 bg-gradient-to-br from-white/40 to-transparent pointer-events-none"
          />
          <div className="flex items-center justify-between mb-2 z-10">
            <span className="text-[10px] text-slate-500 font-bold font-sans uppercase tracking-wider">Focus.Idx</span>
            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-md uppercase tracking-wide ${focus >= 85 ? 'bg-sky-100/50 text-sky-600' : 'bg-amber-100/50 text-amber-600'}`}>
              {focus >= 85 ? 'HIGH' : 'MED'}
            </span>
          </div>
          <div className="flex flex-col justify-end z-10 flex-1">
            <div className="flex items-end gap-2">
              <div className="text-3xl font-bold text-zinc-900 font-mono tracking-tight leading-none">
                <AnimatedNumber value={Math.round(focus)} pad={1} />
              </div>
              <span className="text-sm font-bold text-slate-400 mb-0.5">%</span>
            </div>
            {/* Minimal progress bar */}
            <div className="w-full h-1 bg-slate-100 rounded-full mt-3 overflow-hidden z-10">
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: `${focus}%` }}
                  transition={{ type: "spring", stiffness: 50, damping: 15 }}
                  className={`h-full ${focus >= 85 ? 'bg-sky-400' : 'bg-amber-400'}`}
                />
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
