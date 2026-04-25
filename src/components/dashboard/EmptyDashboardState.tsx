import { motion } from "framer-motion";
import { fadeUpVariant } from "@/lib/motion";
import { Button } from "@/components/ui/button";
import { Plus, Target, Sparkle } from "@phosphor-icons/react";

export function EmptyDashboardState({ onStartMock }: { onStartMock: () => void }) {
  return (
    <motion.div 
      initial="hidden"
      animate="visible"
      variants={fadeUpVariant}
      className="flex flex-col items-center justify-center py-24 px-4 text-center relative w-full"
    >
      <div className="absolute inset-0 flex items-center justify-center -z-10 pointer-events-none">
        <div className="w-[500px] h-[500px] bg-gradient-to-br from-sky-100/40 to-emerald-50/40 blur-3xl rounded-full" />
      </div>

      <div className="relative mb-8 group">
        <div className="absolute inset-0 bg-sky-200/50 blur-xl rounded-full scale-110 group-hover:scale-125 transition-transform duration-700 opacity-50" />
        <div className="w-32 h-32 rounded-full bg-white/80 backdrop-blur-xl border border-white/60 shadow-[0_8px_32px_rgba(0,0,0,0.05)] flex items-center justify-center relative z-10">
          <Target weight="duotone" className="w-16 h-16 text-sky-500" />
          <motion.div 
            animate={{ rotate: 360 }} 
            transition={{ repeat: Infinity, duration: 8, ease: "linear" }}
            className="absolute -top-2 -right-2 text-emerald-400"
          >
            <Sparkle weight="fill" className="w-8 h-8" />
          </motion.div>
        </div>
      </div>

      <h2 className="text-[2.5rem] md:text-[3rem] font-serif tracking-tight text-[#1D2129] leading-tight mb-4 max-w-2xl">
        Your Interview Journey Begins Here.
      </h2>
      <p className="text-[#86909C] text-lg font-medium max-w-xl mb-10 leading-relaxed">
        Complete your first mock interview to unlock personalized telemetry, qualitative feedback, and AI-driven growth insights.
      </p>

      <Button 
        onClick={onStartMock} 
        size="lg" 
        className="rounded-full px-10 h-16 gap-3 font-semibold text-lg shadow-[0_8px_24px_rgba(22,93,255,0.2)] bg-[#165DFF] hover:bg-[#4080FF] text-white transition-all active:scale-[0.98] border border-[#165DFF]/20 group"
      >
        <Plus weight="bold" className="w-6 h-6 group-hover:rotate-90 transition-transform duration-300" /> 
        Start Your First Mock Interview
      </Button>
    </motion.div>
  );
}
