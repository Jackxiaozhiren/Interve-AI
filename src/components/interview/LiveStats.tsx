"use client";

import React, { useEffect, useRef } from "react";
import { motion, animate } from "framer-motion";
import { Pulse, Brain } from "@phosphor-icons/react";
import { useInterveStore } from "@/store/useInterveStore";

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

interface LiveStatsProps {
  wpm: number;
  fillerWordsCount: number;
  visionScore?: number;
  sentimentScore?: number;
  accuracyScore?: number;
}

export const LiveStats = React.memo(({ wpm, fillerWordsCount, visionScore }: LiveStatsProps) => {
  const cognitiveLoad = useInterveStore((state) => state.cognitiveLoad);
  const behavioralTraits = useInterveStore((state) => state.behavioralTraits);
  
  const getWpmStatus = (wpm: number) => {
    if (wpm === 0) return { label: "WAIT", color: "text-slate-400", bg: "bg-slate-100/50" };
    if (wpm < 100) return { label: "SLOW", color: "text-amber-600", bg: "bg-amber-100/50" };
    if (wpm > 160) return { label: "FAST", color: "text-rose-600", bg: "bg-rose-100/50" };
    return { label: "GOOD", color: "text-emerald-600", bg: "bg-emerald-100/50" };
  };

  const wpmStatus = getWpmStatus(wpm);

  return (
    <div className="flex flex-col gap-3 w-full">
      <div className="flex items-center justify-between px-2">
        <div className="flex items-center gap-1.5 text-slate-500">
          <Pulse weight="bold" className="w-4 h-4 text-emerald-500" />
          <span className="text-[10px] font-bold tracking-widest uppercase font-sans text-slate-600">Telemetry</span>
        </div>
      </div>
      
      <div className="grid grid-cols-2 gap-3">
        {/* Pace Tile */}
        <motion.div 
          whileHover={{ y: -4, scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          transition={{ type: "spring", stiffness: 400, damping: 30 }}
          role="region"
          aria-label="Pace Words Per Minute"
          className="flex flex-col p-4 glass-card rounded-2xl relative overflow-hidden group"
        >
          {/* Subtle breathing gradient */}
          <motion.div 
            animate={{ opacity: [0.1, 0.3, 0.1] }}
            transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
            className="absolute inset-0 bg-gradient-to-br from-white/40 to-transparent pointer-events-none"
          />
          <div className="flex items-center justify-between mb-2 z-10">
            <span className="text-[10px] text-slate-500 font-bold font-sans uppercase tracking-wider">Pace.WPM</span>
            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-md uppercase tracking-wide ${wpmStatus.bg} ${wpmStatus.color}`}>
              {wpmStatus.label}
            </span>
          </div>
          <div className="text-3xl font-bold text-zinc-900 font-mono tracking-tight leading-none z-10">
            <AnimatedNumber value={wpm} pad={3} />
          </div>
        </motion.div>

        {/* Filler Words Tile */}
        <motion.div 
          whileHover={{ y: -4, scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          transition={{ type: "spring", stiffness: 400, damping: 30 }}
          role="region"
          aria-label="Filler Words Count"
          className="flex flex-col p-4 glass-card rounded-2xl relative overflow-hidden group"
        >
          <div className="flex items-center justify-between mb-2 z-10">
            <span className="text-[10px] text-slate-500 font-bold font-sans uppercase tracking-wider">Filler</span>
            {fillerWordsCount > 5 ? (
               <span className="text-[9px] text-rose-600 font-bold uppercase tracking-wide bg-rose-100/50 px-1.5 py-0.5 rounded-md shadow-sm">WARN</span>
            ) : (
               <span className="text-[9px] text-emerald-600 font-bold uppercase tracking-wide bg-emerald-100/50 px-1.5 py-0.5 rounded-md shadow-sm">OK</span>
            )}
          </div>
          <div className="text-3xl font-bold text-zinc-900 font-mono tracking-tight leading-none z-10">
            <AnimatedNumber value={fillerWordsCount} pad={2} />
          </div>
        </motion.div>

        {/* Vision Score Tile */}
        {visionScore !== undefined && (
          <motion.div 
            whileHover={{ y: -4, scale: 1.01 }}
            whileTap={{ scale: 0.99 }}
            transition={{ type: "spring", stiffness: 400, damping: 30 }}
            role="region"
            aria-label="Vision Index Score"
            className="flex flex-col p-4 glass-card rounded-2xl col-span-1 relative overflow-hidden group"
          >
            <div className="flex items-center justify-between mb-2 z-10">
              <span className="text-[10px] text-slate-500 font-bold font-sans uppercase tracking-wider">Vision</span>
              <span className={`text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-md shadow-sm ${visionScore >= 80 ? 'text-emerald-600 bg-emerald-100/50' : 'text-amber-600 bg-amber-100/50'}`}>
                {visionScore >= 80 ? 'GOOD' : 'POOR'}
              </span>
            </div>
            <div className="flex items-end gap-2 z-10">
              <div className="text-3xl font-bold text-zinc-900 font-mono tracking-tight leading-none">
                <AnimatedNumber value={Math.round(visionScore)} pad={1} />
              </div>
              <span className="text-sm font-bold text-slate-400 mb-0.5">%</span>
            </div>
            {/* Minimal progress bar */}
            <div className="w-full h-1 bg-slate-100 rounded-full mt-3 overflow-hidden z-10">
               <motion.div 
                 initial={{ width: 0 }}
                 animate={{ width: `${visionScore}%` }}
                 transition={{ type: "spring", stiffness: 50, damping: 15 }}
                 className={`h-full ${visionScore >= 80 ? 'bg-emerald-400' : 'bg-amber-400'}`}
               />
            </div>
          </motion.div>
        )}

        {/* Cognitive Load Tile */}
        <motion.div 
          whileHover={{ y: -4, scale: 1.01 }}
          whileTap={{ scale: 0.99 }}
          transition={{ type: "spring", stiffness: 400, damping: 30 }}
          role="region"
          aria-label="Cognitive Load Score"
          className={`flex flex-col p-4 glass-card rounded-2xl col-span-2 relative overflow-hidden group`}
        >
          {/* Stress ripple effect */}
          {cognitiveLoad > 70 && (
            <motion.div 
              animate={{ scale: [1, 1.5, 1], opacity: [0, 0.2, 0] }}
              transition={{ duration: 2, repeat: Infinity, ease: "easeOut" }}
              className="absolute inset-0 bg-rose-500/20 pointer-events-none rounded-2xl"
            />
          )}
          <div className="flex items-center justify-between mb-2 z-10">
            <div className="flex items-center gap-1">
              <Brain weight="bold" className={`w-3 h-3 ${cognitiveLoad > 70 ? 'text-rose-500 animate-pulse' : 'text-slate-400'}`} />
              <span className="text-[10px] text-slate-500 font-bold font-sans uppercase tracking-wider">Load</span>
            </div>
            <span className={`text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-md shadow-sm ${
              cognitiveLoad < 40 ? 'text-emerald-600 bg-emerald-100/50' : 
              cognitiveLoad < 70 ? 'text-amber-600 bg-amber-100/50' : 
              'text-rose-600 bg-rose-100/50'
            }`}>
              {cognitiveLoad < 40 ? 'LOW' : cognitiveLoad < 70 ? 'MED' : 'HIGH'}
            </span>
          </div>
          <div className="flex items-end gap-2 z-10">
            <div className={`text-3xl font-bold font-mono tracking-tight leading-none ${
              cognitiveLoad > 70 ? 'text-rose-600' : 'text-zinc-900'
            }`}>
              <AnimatedNumber value={Math.round(cognitiveLoad)} pad={1} />
            </div>
            <span className="text-sm font-bold text-slate-400 mb-0.5">%</span>
          </div>
          {/* Dynamic stress bar */}
          <div className="w-full h-1 bg-slate-100 rounded-full mt-3 overflow-hidden z-10 relative">
             <motion.div 
               initial={{ width: 0 }}
               animate={{ width: `${cognitiveLoad}%` }}
               transition={{ type: "spring", stiffness: 50, damping: 15 }}
               className={`h-full absolute left-0 top-0 ${
                 cognitiveLoad < 40 ? 'bg-emerald-400' : 
                 cognitiveLoad < 70 ? 'bg-amber-400' : 
                 'bg-rose-500'
               }`}
             />
          </div>
        </motion.div>
        
        {/* STAR Progress Tile */}
        <motion.div 
          whileHover={{ y: -4, scale: 1.01 }}
          whileTap={{ scale: 0.99 }}
          transition={{ type: "spring", stiffness: 400, damping: 30 }}
          role="region"
          aria-label="STAR Assessment Progress"
          className="flex flex-col p-4 glass-card rounded-2xl col-span-2 relative overflow-hidden group"
        >
          <div className="flex items-center justify-between mb-3 z-10">
            <span className="text-[10px] text-slate-500 font-bold font-sans uppercase tracking-wider">STAR Progress</span>
            <span className="text-[9px] text-blue-600 font-bold uppercase tracking-wide bg-blue-100/50 px-1.5 py-0.5 rounded-md shadow-sm">AI ASSESS</span>
          </div>
          <div className="grid grid-cols-4 gap-2 z-10">
            {[
              { label: 'S', value: useInterveStore((state) => state.starProgress.s.progress) },
              { label: 'T', value: useInterveStore((state) => state.starProgress.t.progress) },
              { label: 'A', value: useInterveStore((state) => state.starProgress.a.progress) },
              { label: 'R', value: useInterveStore((state) => state.starProgress.r.progress) },
            ].map((item, idx) => (
              <div key={idx} className="flex flex-col items-center gap-1.5">
                <div className="w-full h-12 bg-slate-100 rounded-lg overflow-hidden relative flex items-end justify-center">
                  <motion.div 
                    initial={{ height: 0 }}
                    animate={{ height: `${item.value}%` }}
                    transition={{ type: "spring", stiffness: 50, damping: 15 }}
                    className={`w-full absolute bottom-0 ${
                      item.value > 80 ? 'bg-emerald-400' : 
                      item.value > 40 ? 'bg-blue-400' : 
                      'bg-slate-300'
                    }`}
                  />
                  <span className="text-[8px] font-bold text-white z-10 mb-1 mix-blend-difference">{Math.round(item.value)}%</span>
                </div>
                <span className="text-[10px] font-bold text-slate-600 font-sans">{item.label}</span>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Behavioral Traits Tile */}
        <motion.div 
          whileHover={{ y: -4, scale: 1.01 }}
          whileTap={{ scale: 0.99 }}
          transition={{ type: "spring", stiffness: 400, damping: 30 }}
          role="region"
          aria-label="Behavioral Traits Assessment"
          className="flex flex-col p-4 glass-card rounded-2xl col-span-2 relative overflow-hidden group"
        >
          <div className="flex items-center justify-between mb-3 z-10">
            <span className="text-[10px] text-slate-500 font-bold font-sans uppercase tracking-wider">Behavioral Traits</span>
            <span className="text-[9px] text-purple-600 font-bold uppercase tracking-wide bg-purple-100/50 px-1.5 py-0.5 rounded-md shadow-sm">AI ASSESS</span>
          </div>
          <div className="flex flex-col gap-3 z-10">
            {[
              { label: 'Leadership', value: behavioralTraits.leadership, color: 'bg-violet-400' },
              { label: 'Problem Solving', value: behavioralTraits.problemSolving, color: 'bg-fuchsia-400' },
              { label: 'Communication', value: behavioralTraits.communication, color: 'bg-cyan-400' },
            ].map((trait, idx) => (
              <div key={idx} className="flex flex-col gap-1.5">
                <div className="flex justify-between items-center">
                  <span className="text-[10px] font-bold text-slate-600 font-sans">{trait.label}</span>
                  <span className="text-[10px] font-bold text-slate-400 font-mono">{Math.round(trait.value)}%</span>
                </div>
                <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden relative">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${trait.value}%` }}
                    transition={{ type: "spring", stiffness: 50, damping: 15 }}
                    className={`absolute left-0 top-0 h-full ${trait.color}`}
                  />
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </div>
  );
});

LiveStats.displayName = 'LiveStats';

