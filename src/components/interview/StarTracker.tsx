import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle, WarningCircle, Lightbulb } from "@phosphor-icons/react";
import { useInterveStore } from "@/store/useInterveStore";

export function StarTracker() {
  const { starProgress } = useInterveStore();

  const steps = [
    { key: "S", label: "Situation", data: starProgress.s },
    { key: "T", label: "Task", data: starProgress.t },
    { key: "A", label: "Action", data: starProgress.a },
    { key: "R", label: "Result", data: starProgress.r },
  ];

  const getFeedbackMessage = () => {
    const ramblingStep = steps.find(s => s.data.timeSpentSeconds > 120 && s.data.progress < 50);
    if (ramblingStep) {
      return `You're spending a lot of time on ${ramblingStep.label}. Try to wrap up and move to the next phase.`;
    }

    const activeStep = steps.find(s => s.data.progress < 70);
    if (!activeStep) return "Excellent! You've provided a complete STAR response.";

    if (activeStep.data.progress === 0 && activeStep.key === "S") {
      return "Listen to the question carefully and begin with the Situation.";
    }

    switch (activeStep.key) {
      case "S":
        return activeStep.data.timeSpentSeconds > 45 
          ? "Keep the Situation brief. Move on to your Task." 
          : "Set the scene. What was the context of your challenge?";
      case "T":
        return "Clearly define what was expected of you. Be specific about your goal.";
      case "A":
        return "Focus on 'I', not 'We'. Detail the specific steps you took.";
      case "R":
        return "Share the outcome. Quantify your impact with metrics if possible.";
      default:
        return "Keep going!";
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="absolute top-6 left-6 z-20 bg-white/70 backdrop-blur-xl border border-white/80 p-4 rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.06)] flex flex-col gap-4 min-w-[280px]"
    >
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-bold tracking-widest text-slate-500 uppercase flex items-center gap-2">
          <span>STAR Tracker</span>
        </h3>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-slate-400 font-medium">Real-time Analysis</span>
          <div className="w-2 h-2 rounded-full bg-sky-400 animate-pulse" />
        </div>
      </div>
      
      <div className="flex justify-between items-start w-full gap-2 relative mt-2">
        {/* Connecting lines */}
        <div className="absolute top-4 left-4 w-[calc(100%-2rem)] h-[2px] bg-slate-100 z-0 overflow-hidden rounded-full">
           <motion.div 
              className="h-full bg-sky-400/30"
              initial={{ width: 0 }}
              animate={{ width: `${(steps.filter(s => s.data.progress >= 50).length / 4) * 100}%` }}
              transition={{ duration: 0.5 }}
           />
        </div>
        
        {steps.map((step) => {
          const isActive = step.data.progress > 0;
          const isComplete = step.data.progress >= 70;
          const isRambling = step.data.timeSpentSeconds > 120 && step.data.progress < 50;

          return (
            <div key={step.key} className="relative z-10 flex flex-col items-center gap-2 group w-12">
              <div className="relative">
                <motion.div 
                  animate={{ 
                    backgroundColor: isComplete ? "#0ea5e9" : isActive ? "#e0f2fe" : "#f1f5f9",
                    borderColor: isComplete ? "#0284c7" : isActive ? "#7dd3fc" : "#e2e8f0",
                    color: isComplete ? "#ffffff" : isActive ? "#0284c7" : "#64748b",
                    scale: isActive ? 1.05 : 1
                  }}
                  transition={{ type: "spring", stiffness: 300, damping: 20 }}
                  className="w-8 h-8 rounded-full border-2 flex items-center justify-center font-bold text-[13px] shadow-sm relative transition-colors duration-300"
                >
                  {isComplete ? (
                    <CheckCircle className="w-5 h-5 text-white" weight="bold" />
                  ) : (
                    step.key
                  )}
                </motion.div>
                
                {/* Progress Ring (SVG) */}
                {!isComplete && (
                   <svg className="absolute top-0 left-0 w-8 h-8 -rotate-90 pointer-events-none">
                     <circle 
                       cx="16" cy="16" r="15" 
                       fill="transparent" 
                       stroke="currentColor" 
                       strokeWidth="2" 
                       strokeDasharray={`${(step.data.progress / 100) * 94.2} 94.2`} 
                       className={isActive ? "text-sky-400/50" : "text-transparent"}
                     />
                   </svg>
                )}

                {/* Warning Indicator */}
                {isRambling && (
                  <motion.div 
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="absolute -top-1 -right-1 bg-amber-100 text-amber-500 rounded-full"
                  >
                    <WarningCircle weight="fill" className="w-4 h-4" />
                  </motion.div>
                )}
              </div>

              <div className="flex flex-col items-center">
                <span className={`text-[10px] font-semibold uppercase tracking-wider transition-colors duration-300 ${isComplete ? 'text-sky-600' : isActive ? 'text-slate-600' : 'text-slate-400'}`}>
                  {step.label}
                </span>
                <span className="text-[9px] text-slate-400 mt-0.5 tabular-nums">
                  {step.data.progress}%
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Deeper Real-time Feedback Logic */}
      <AnimatePresence mode="popLayout">
        <motion.div 
          key={getFeedbackMessage()}
          initial={{ opacity: 0, height: 0, marginTop: 0 }}
          animate={{ opacity: 1, height: "auto", marginTop: 8 }}
          exit={{ opacity: 0, height: 0, marginTop: 0 }}
          transition={{ duration: 0.3 }}
          className="pt-3 border-t border-slate-100/50 overflow-hidden"
        >
          <div className="flex items-start gap-2 bg-slate-50/50 p-2.5 rounded-xl border border-slate-100">
             <Lightbulb className="w-4 h-4 text-sky-500 mt-0.5 shrink-0" weight="duotone" />
             <p className="text-[11.5px] leading-snug text-slate-600 font-medium">
               {getFeedbackMessage()}
             </p>
          </div>
        </motion.div>
      </AnimatePresence>
    </motion.div>
  );
}
