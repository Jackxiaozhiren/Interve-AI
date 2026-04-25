import React from "react";
import { motion } from "framer-motion";
import { CheckCircle, XCircle, Lightbulb, Target } from "@phosphor-icons/react";
import { springConfig } from "@/lib/motion";

interface KnowledgeMatchGraphProps {
  matchData: {
    overallScore: number;
    alignedSkills: string[];
    missingSkills: string[];
    recommendations: string[];
  };
}

export function KnowledgeMatchGraph({ matchData }: KnowledgeMatchGraphProps) {
  // Determine color based on score
  const getScoreColor = (score: number) => {
    if (score >= 80) return "text-emerald-500";
    if (score >= 60) return "text-orange-500";
    return "text-rose-500";
  };

  const scoreColor = getScoreColor(matchData.overallScore);

  return (
    <div className="flex flex-col md:flex-row gap-6 w-full">
      {/* Score Circle */}
      <div className="flex flex-col items-center justify-center p-6 bg-white/50 hover:bg-white/60 backdrop-blur-xl border border-white/40 hover:border-white/80 rounded-3xl shadow-[0_8px_32px_-8px_rgba(0,0,0,0.05)] hover:shadow-[0_16px_48px_-12px_rgba(0,0,0,0.1)] transition-all duration-500 ease-out hover:-translate-y-1 w-full md:w-1/3">
        <Target size={32} className="text-sky-500 mb-4" weight="duotone" />
        <h3 className="text-sm font-medium text-slate-500 uppercase tracking-wider mb-2">Match Score</h3>
        <div className="relative w-32 h-32 flex items-center justify-center mb-2">
          {/* Circular Progress SVG */}
          <svg className="absolute inset-0 w-full h-full transform -rotate-90">
            <circle
              cx="64"
              cy="64"
              r="56"
              fill="none"
              stroke="currentColor"
              strokeWidth="8"
              className="text-slate-100"
            />
            <motion.circle
              cx="64"
              cy="64"
              r="56"
              fill="none"
              stroke="currentColor"
              strokeWidth="8"
              strokeDasharray={351.86} // 2 * pi * 56
              strokeDashoffset={351.86 - (351.86 * matchData.overallScore) / 100}
              strokeLinecap="round"
              className={scoreColor}
              initial={{ strokeDashoffset: 351.86 }}
              animate={{ strokeDashoffset: 351.86 - (351.86 * matchData.overallScore) / 100 }}
              transition={{ duration: 1.5, ease: "easeOut" }}
            />
          </svg>
          <motion.span 
            className={`text-4xl font-bold ${scoreColor}`}
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={springConfig}
          >
            {matchData.overallScore}%
          </motion.span>
        </div>
        <p className="text-xs text-slate-400 text-center mt-2">
          Alignment between your resume and the job description.
        </p>
      </div>

      {/* Details Container */}
      <div className="flex-1 flex flex-col gap-4">
        {/* Skills Row */}
        <div className="flex flex-col sm:flex-row gap-4 flex-1">
          {/* Aligned Skills */}
          <div className="flex-1 bg-white/50 hover:bg-white/70 backdrop-blur-xl border border-emerald-100/50 hover:border-emerald-200/60 rounded-2xl p-5 shadow-[0_4px_24px_-8px_rgba(0,0,0,0.04)] hover:shadow-[0_8px_32px_-8px_rgba(16,185,129,0.1)] transition-all duration-500 group">
            <div className="flex items-center gap-2 mb-4">
              <CheckCircle size={20} className="text-emerald-500 group-hover:scale-110 transition-transform duration-300" weight="fill" />
              <h4 className="text-sm font-semibold text-slate-700">Aligned Skills</h4>
            </div>
            <div className="flex flex-wrap gap-2">
              {matchData.alignedSkills.length > 0 ? (
                matchData.alignedSkills.map((skill, idx) => (
                  <span key={idx} className="px-3 py-1 bg-emerald-50/80 hover:bg-emerald-100 text-emerald-700 text-xs rounded-full border border-emerald-100/50 hover:border-emerald-200 hover:-translate-y-0.5 transition-all duration-300 cursor-default shadow-sm hover:shadow">
                    {skill}
                  </span>
                ))
              ) : (
                <span className="text-sm text-slate-400 italic">No exact matches found.</span>
              )}
            </div>
          </div>

          {/* Missing Skills */}
          <div className="flex-1 bg-white/50 hover:bg-white/70 backdrop-blur-xl border border-rose-100/50 hover:border-rose-200/60 rounded-2xl p-5 shadow-[0_4px_24px_-8px_rgba(0,0,0,0.04)] hover:shadow-[0_8px_32px_-8px_rgba(244,63,94,0.1)] transition-all duration-500 group">
            <div className="flex items-center gap-2 mb-4">
              <XCircle size={20} className="text-rose-500 group-hover:scale-110 transition-transform duration-300" weight="fill" />
              <h4 className="text-sm font-semibold text-slate-700">Missing Skills</h4>
            </div>
            <div className="flex flex-wrap gap-2">
              {matchData.missingSkills.length > 0 ? (
                matchData.missingSkills.map((skill, idx) => (
                  <span key={idx} className="px-3 py-1 bg-rose-50/80 hover:bg-rose-100 text-rose-700 text-xs rounded-full border border-rose-100/50 hover:border-rose-200 hover:-translate-y-0.5 transition-all duration-300 cursor-default shadow-sm hover:shadow">
                    {skill}
                  </span>
                ))
              ) : (
                <span className="text-sm text-slate-400 italic">No significant gaps identified.</span>
              )}
            </div>
          </div>
        </div>

        {/* Recommendations */}
        <div className="bg-gradient-to-br from-sky-50 to-sky-50/30 hover:from-sky-100/60 hover:to-sky-50/50 backdrop-blur-xl border border-sky-100/60 hover:border-sky-200/80 rounded-2xl p-5 shadow-[0_4px_24px_-8px_rgba(0,0,0,0.04)] hover:shadow-[0_8px_32px_-8px_rgba(14,165,233,0.15)] transition-all duration-500 group">
          <div className="flex items-center gap-2 mb-3">
            <Lightbulb size={20} className="text-sky-500 group-hover:scale-110 group-hover:text-amber-400 transition-all duration-300" weight="fill" />
            <h4 className="text-sm font-semibold text-slate-700">Actionable Recommendations</h4>
          </div>
          <ul className="space-y-2">
            {matchData.recommendations.map((rec, idx) => (
              <motion.li 
                key={idx} 
                className="text-sm text-slate-600 flex items-start gap-2"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: idx * 0.1, ...springConfig }}
              >
                <span className="text-sky-400 mt-0.5">•</span>
                {rec}
              </motion.li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
