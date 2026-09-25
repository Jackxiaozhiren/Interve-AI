"use client";

import React, { useEffect, useRef } from "react";
import { motion, animate } from "framer-motion";
import { Pulse, Brain } from "@phosphor-icons/react";
import { useInterveStore } from "@/store/useInterveStore";
import { useLanguage } from "@/lib/i18n/LanguageContext";

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
  /** Phase 9: AI-estimated tiles hidden by default (score distraction). */
  showAiEstimates?: boolean;
}

// Phase 3 (Truthfulness Reset): `visionScore` (random-walk fake), plus dead
// `sentimentScore`/`accuracyScore` props, are removed. WPM and filler counts
// are measured from the speech recognizer. STAR/behavior tiles below are
// LLM estimates and are now badged Experimental until the Phase 4
// evidence-grounded rubric engine lands.
export const LiveStats = React.memo(({ wpm, fillerWordsCount, showAiEstimates = false }: LiveStatsProps) => {
  const { t } = useLanguage();
  const cognitiveLoad = useInterveStore((state) => state.cognitiveLoad);
  // Phase 9: subscriptions stay unconditional (rules-of-hooks); the tiles
  // below render conditionally on showAiEstimates.
  const starS = useInterveStore((state) => state.starProgress.s.progress);
  const starT = useInterveStore((state) => state.starProgress.t.progress);
  const starA = useInterveStore((state) => state.starProgress.a.progress);
  const starR = useInterveStore((state) => state.starProgress.r.progress);
  const behavioralTraits = useInterveStore((state) => state.behavioralTraits);
  // Steering envelope (§7): verbatim quotes behind the live numbers.
  const starEvidence = useInterveStore((state) => state.starEvidence);
  const starConfidence = useInterveStore((state) => state.starConfidence);
  const traitsEvidence = useInterveStore((state) => state.traitsEvidence);
  const traitsConfidence = useInterveStore((state) => state.traitsConfidence);
  
  // F5-2: badge text deepened one step (axe color-contrast on /50 badges).
  const getWpmStatus = (wpm: number) => {
    if (wpm === 0) return { label: "WAIT", color: "text-slate-600", bg: "bg-slate-100/70" };
    if (wpm < 100) return { label: "SLOW", color: "text-amber-700", bg: "bg-amber-100/70" };
    if (wpm > 160) return { label: "FAST", color: "text-rose-700", bg: "bg-rose-100/70" };
    return { label: "GOOD", color: "text-emerald-800", bg: "bg-emerald-100/70" };
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
            <span className="text-[10px] text-slate-600 font-bold font-sans uppercase tracking-wider">Pace.WPM</span>
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
            <span className="text-[10px] text-slate-600 font-bold font-sans uppercase tracking-wider">Filler</span>
            {fillerWordsCount > 5 ? (
               <span className="text-[9px] text-rose-800 font-bold uppercase tracking-wide bg-rose-100/70 px-1.5 py-0.5 rounded-md shadow-sm">WARN</span>
            ) : (
               <span className="text-[9px] text-emerald-800 font-bold uppercase tracking-wide bg-emerald-100/70 px-1.5 py-0.5 rounded-md shadow-sm">OK</span>
            )}
          </div>
          <div className="text-3xl font-bold text-zinc-900 font-mono tracking-tight leading-none z-10">
            <AnimatedNumber value={fillerWordsCount} pad={2} />
          </div>
        </motion.div>

        {/* Phase 3: Vision tile removed (was random-walk fake). */}

        {/* Delivery Strain Tile (experimental heuristic, opt-in) */}
        {showAiEstimates && (
        <motion.div 
          whileHover={{ y: -4, scale: 1.01 }}
          whileTap={{ scale: 0.99 }}
          transition={{ type: "spring", stiffness: 400, damping: 30 }}
          role="region"
          aria-label="Delivery strain estimate, experimental"
          className={`flex flex-col p-4 glass-card rounded-2xl col-span-2 relative overflow-hidden group`}
        >
          <div className="flex items-center justify-between mb-2 z-10">
            <div className="flex items-center gap-1">
              <Brain weight="bold" className="w-3 h-3 text-slate-400" />
              <span className="text-[10px] text-slate-600 font-bold font-sans uppercase tracking-wider">Strain</span>
            </div>
            <span className="text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-md shadow-sm text-slate-600 bg-slate-100">
              {t.interview.experimental}
            </span>
          </div>
          <div className="flex items-end gap-2 z-10">
            <div className="text-3xl font-bold font-mono tracking-tight leading-none text-zinc-900">
              <AnimatedNumber value={Math.round(cognitiveLoad)} pad={1} />
            </div>
            <span className="text-sm font-bold text-slate-500 mb-0.5">%</span>
          </div>
          <p className="text-[9px] text-slate-500 mt-2 z-10 leading-relaxed">
            {t.interview.strainCaption}
          </p>
          {/* Strain bar */}
          <div className="w-full h-1 bg-slate-100 rounded-full mt-2 overflow-hidden z-10 relative">
            <motion.div 
              initial={{ width: 0 }}
              animate={{ width: `${cognitiveLoad}%` }}
              transition={{ type: "spring", stiffness: 50, damping: 15 }}
              className="h-full absolute left-0 top-0 bg-slate-400"
            />
          </div>
        </motion.div>
        )}
        
        {/* STAR Progress Tile (experimental LLM estimate, opt-in) */}
        {showAiEstimates && (
        <motion.div 
          whileHover={{ y: -4, scale: 1.01 }}
          whileTap={{ scale: 0.99 }}
          transition={{ type: "spring", stiffness: 400, damping: 30 }}
          role="region"
          aria-label="STAR Assessment Progress"
          className="flex flex-col p-4 glass-card rounded-2xl col-span-2 relative overflow-hidden group"
        >
          <div className="flex items-center justify-between mb-3 z-10">
            <span className="text-[10px] text-slate-600 font-bold font-sans uppercase tracking-wider">STAR Progress</span>
            <span className="text-[9px] text-slate-600 font-bold uppercase tracking-wide bg-slate-100 px-1.5 py-0.5 rounded-md shadow-sm">{t.interview.aiEstimate} · {t.interview.experimental}</span>
          </div>
          <div className="grid grid-cols-4 gap-2 z-10">
            {[
              { label: 'S', value: starS },
              { label: 'T', value: starT },
              { label: 'A', value: starA },
              { label: 'R', value: starR },
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
          {/* Steering envelope (§7): grounding rides with the numbers — old
              sessions without evidence render exactly as before. */}
          {starEvidence.length > 0 && (
            <div className="mt-3 z-10 border-t border-slate-100/70 pt-2">
              <p className="text-[9px] text-slate-500 leading-relaxed">
                Basis in your answer: “{starEvidence[0]}”
                {starEvidence.length > 1 ? ` (+${starEvidence.length - 1} more)` : ""}
                {` · Evaluator confidence: ${starConfidence} (evidence sufficiency)`}
              </p>
            </div>
          )}
        </motion.div>
        )}

        {/* Behavioral Traits Tile (experimental LLM estimate, opt-in) */}
        {showAiEstimates && (
        <motion.div 
          whileHover={{ y: -4, scale: 1.01 }}
          whileTap={{ scale: 0.99 }}
          transition={{ type: "spring", stiffness: 400, damping: 30 }}
          role="region"
          aria-label="Behavioral Traits Assessment"
          className="flex flex-col p-4 glass-card rounded-2xl col-span-2 relative overflow-hidden group"
        >
          <div className="flex items-center justify-between mb-3 z-10">
            <span className="text-[10px] text-slate-600 font-bold font-sans uppercase tracking-wider">Behavioral Traits</span>
            <span className="text-[9px] text-slate-600 font-bold uppercase tracking-wide bg-slate-100 px-1.5 py-0.5 rounded-md shadow-sm">{t.interview.aiEstimate} · {t.interview.experimental}</span>
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
                  <span className="text-[10px] font-bold text-slate-500 font-mono">{Math.round(trait.value)}%</span>
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
          {/* Steering envelope (§7): see STAR tile above. */}
          {traitsEvidence.length > 0 && (
            <div className="mt-3 z-10 border-t border-slate-100/70 pt-2">
              <p className="text-[9px] text-slate-500 leading-relaxed">
                Basis in your answer: “{traitsEvidence[0]}”
                {traitsEvidence.length > 1 ? ` (+${traitsEvidence.length - 1} more)` : ""}
                {` · Evaluator confidence: ${traitsConfidence} (evidence sufficiency)`}
              </p>
            </div>
          )}
        </motion.div>
        )}
      </div>
    </div>
  );
});

LiveStats.displayName = 'LiveStats';

