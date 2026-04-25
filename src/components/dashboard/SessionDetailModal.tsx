"use client";

import React, { useEffect } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Play, Timer, ChatCircleDots, ThumbsUp, ThumbsDown, HandHeart, X } from "@phosphor-icons/react";
import { ExportDossierButton } from "@/components/dashboard/ExportDossierButton";
import { AnimatedCounter } from "@/components/ui/animated-counter";
import { TextReveal } from "@/components/ui/text-reveal";
import { InterviewTimeline } from "@/components/interview/InterviewTimeline";
import { KnowledgeMatchLoader } from "@/components/dashboard/KnowledgeMatchLoader";
import { useModalState } from "@/app/dashboard/layout";
import type { Interview } from "@/lib/db";

const VERDICT_STYLES = {
  strong_hire: { bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-700', icon: ThumbsUp, label: 'Strong Hire' },
  hire: { bg: 'bg-emerald-50/50', border: 'border-emerald-100', text: 'text-emerald-600', icon: ThumbsUp, label: 'Hire' },
  leaning_hire: { bg: 'bg-sky-50', border: 'border-sky-200', text: 'text-sky-700', icon: HandHeart, label: 'Leaning Hire' },
  leaning_no_hire: { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-700', icon: HandHeart, label: 'Leaning No Hire' },
  no_hire: { bg: 'bg-rose-50', border: 'border-rose-200', text: 'text-rose-700', icon: ThumbsDown, label: 'No Hire' },
};

export function SessionDetailModal({ session, onClose }: { session: Interview, onClose: () => void }) {
  const { setIsModalOpen } = useModalState();

  // Lock body scroll when modal is open and trigger layout scale down
  useEffect(() => {
    document.body.style.overflow = "hidden";
    setIsModalOpen(true);
    return () => {
      document.body.style.overflow = "";
      setIsModalOpen(false);
    };
  }, [setIsModalOpen]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.4 }}
      className="fixed inset-0 z-50 flex justify-center items-end md:items-center bg-slate-900/40 backdrop-blur-sm px-0 md:px-6 py-0 md:py-12"
      onClick={onClose}
    >
      <motion.div
        initial={{ y: "100%", scale: 0.95 }}
        animate={{ y: 0, scale: 1 }}
        exit={{ y: "100%", scale: 0.95 }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
        className="w-full max-w-5xl bg-white shadow-2xl overflow-hidden rounded-t-[32px] md:rounded-[32px] h-[90vh] md:h-auto md:max-h-full flex flex-col relative"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="session-modal-title"
      >
        {/* Sticky Header */}
        <div className="flex items-center justify-between p-6 md:p-8 border-b border-slate-100/60 bg-white/80 backdrop-blur-md z-30 sticky top-0">
          <div>
            <h2 id="session-modal-title" className="font-serif text-[2rem] tracking-tight text-[#111111] leading-none mb-2">{session.title}</h2>
            <div className="text-sm font-bold font-mono text-slate-500 uppercase tracking-widest">
              {new Date(session.createdAt).toLocaleDateString()}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Button 
              variant="outline" 
              className="rounded-full shadow-sm hidden md:flex"
              onClick={() => window.location.href = `/dashboard/replay/${session.id}`}
            >
              <Play className="w-4 h-4 mr-2" weight="fill" />
              Interactive Replay
            </Button>
            <ExportDossierButton session={session} fileName={`Interview_Dossier_${session.id}.pdf`} />
            <button 
              onClick={onClose}
              aria-label="Close session details"
              className="w-12 h-12 rounded-full bg-slate-50 hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:ring-offset-2 text-slate-500 flex items-center justify-center transition-colors ml-2"
            >
              <X weight="bold" className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="overflow-y-auto p-6 md:p-10 pb-20 bg-gradient-to-b from-slate-50/50 to-transparent flex-1 relative custom-scrollbar">
          <div id={`dossier-${session.id}`} className="space-y-16">
            {/* Verdict Banner */}
            {session.hireVerdict && VERDICT_STYLES[session.hireVerdict as keyof typeof VERDICT_STYLES] && (
              <div className={`p-8 rounded-[32px] border ${VERDICT_STYLES[session.hireVerdict as keyof typeof VERDICT_STYLES].bg} ${VERDICT_STYLES[session.hireVerdict as keyof typeof VERDICT_STYLES].border} shadow-sm relative overflow-hidden`}>
                <div className="relative z-10 flex flex-col md:flex-row gap-8 items-start md:items-center">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-3">
                      {React.createElement(VERDICT_STYLES[session.hireVerdict as keyof typeof VERDICT_STYLES].icon, { 
                        weight: "duotone", 
                        className: `w-8 h-8 ${VERDICT_STYLES[session.hireVerdict as keyof typeof VERDICT_STYLES].text}` 
                      })}
                      <h3 className={`font-serif text-[2rem] tracking-tight ${VERDICT_STYLES[session.hireVerdict as keyof typeof VERDICT_STYLES].text} leading-none`}>
                        {VERDICT_STYLES[session.hireVerdict as keyof typeof VERDICT_STYLES].label}
                      </h3>
                    </div>
                    <p className={`text-[1.1rem] leading-relaxed font-medium ${VERDICT_STYLES[session.hireVerdict as keyof typeof VERDICT_STYLES].text} opacity-90`}>
                      {session.verdictRationale || "Based on your overall interview performance."}
                    </p>
                  </div>
                  
                  {/* Delivery Stats Mini-Cards */}
                  {session.deliveryStats && (
                    <div className="flex gap-4 shrink-0">
                      <div className="bg-white/60 backdrop-blur-sm px-6 py-4 rounded-[20px] border border-white/80 shadow-sm text-center">
                        <div className="flex items-center justify-center gap-2 mb-1">
                          <Timer className="w-4 h-4 text-slate-400" />
                          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-widest font-mono">WPM</span>
                        </div>
                        <div className="text-2xl font-light text-[#111111]"><AnimatedCounter value={session.deliveryStats.wpm} /></div>
                      </div>
                      <div className="bg-white/60 backdrop-blur-sm px-6 py-4 rounded-[20px] border border-white/80 shadow-sm text-center">
                        <div className="flex items-center justify-center gap-2 mb-1">
                          <ChatCircleDots className="w-4 h-4 text-slate-400" />
                          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-widest font-mono">Fillers</span>
                        </div>
                        <div className="text-2xl font-light text-[#111111]"><AnimatedCounter value={session.deliveryStats.fillerWords} /></div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Council Debate */}
            {session.councilDebate && (
              <div className="space-y-6">
                <div className="flex items-center gap-4">
                  <h4 className="text-[1.5rem] font-serif text-[#111111] leading-relaxed">Hiring Council Debate</h4>
                  <div className="h-px flex-1 bg-slate-100"></div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {/* Technical Advisor */}
                  <div className="bg-white border border-slate-100 rounded-[24px] p-8 shadow-sm relative overflow-hidden group/advisor">
                    <div className="absolute inset-0 bg-gradient-to-br from-sky-50/50 to-transparent opacity-0 group-hover/advisor:opacity-100 transition-opacity duration-500" />
                    <div className="relative z-10">
                      <div className="flex items-center gap-3 mb-6">
                        <div className="w-12 h-12 rounded-[16px] bg-sky-50 border border-sky-100 flex items-center justify-center">
                          <span className="text-sky-500 font-mono font-bold text-lg">T</span>
                        </div>
                        <div>
                          <div className="text-[11px] font-bold text-slate-400 uppercase tracking-widest font-mono">Technical</div>
                          <div className={`text-sm font-bold uppercase tracking-wide ${session.councilDebate.technicalAdvisor.stance.includes('no_hire') ? 'text-rose-600' : session.councilDebate.technicalAdvisor.stance.includes('leaning') ? 'text-amber-600' : 'text-emerald-600'}`}>
                            {session.councilDebate.technicalAdvisor.stance.replace(/_/g, ' ')}
                          </div>
                        </div>
                      </div>
                      <p className="text-slate-600 text-[14px] leading-relaxed font-medium">&quot;{session.councilDebate.technicalAdvisor.reasoning}&quot;</p>
                    </div>
                  </div>

                  {/* HR Advisor */}
                  <div className="bg-white border border-slate-100 rounded-[24px] p-8 shadow-sm relative overflow-hidden group/advisor">
                    <div className="absolute inset-0 bg-gradient-to-br from-rose-50/50 to-transparent opacity-0 group-hover/advisor:opacity-100 transition-opacity duration-500" />
                    <div className="relative z-10">
                      <div className="flex items-center gap-3 mb-6">
                        <div className="w-12 h-12 rounded-[16px] bg-rose-50 border border-rose-100 flex items-center justify-center">
                          <span className="text-rose-500 font-mono font-bold text-lg">H</span>
                        </div>
                        <div>
                          <div className="text-[11px] font-bold text-slate-400 uppercase tracking-widest font-mono">HR / Comms</div>
                          <div className={`text-sm font-bold uppercase tracking-wide ${session.councilDebate.hrAdvisor.stance.includes('no_hire') ? 'text-rose-600' : session.councilDebate.hrAdvisor.stance.includes('leaning') ? 'text-amber-600' : 'text-emerald-600'}`}>
                            {session.councilDebate.hrAdvisor.stance.replace(/_/g, ' ')}
                          </div>
                        </div>
                      </div>
                      <p className="text-slate-600 text-[14px] leading-relaxed font-medium">&quot;{session.councilDebate.hrAdvisor.reasoning}&quot;</p>
                    </div>
                  </div>

                  {/* Culture Fit Advisor */}
                  <div className="bg-white border border-slate-100 rounded-[24px] p-8 shadow-sm relative overflow-hidden group/advisor">
                    <div className="absolute inset-0 bg-gradient-to-br from-emerald-50/50 to-transparent opacity-0 group-hover/advisor:opacity-100 transition-opacity duration-500" />
                    <div className="relative z-10">
                      <div className="flex items-center gap-3 mb-6">
                        <div className="w-12 h-12 rounded-[16px] bg-emerald-50 border border-emerald-100 flex items-center justify-center">
                          <span className="text-emerald-500 font-mono font-bold text-lg">C</span>
                        </div>
                        <div>
                          <div className="text-[11px] font-bold text-slate-400 uppercase tracking-widest font-mono">Culture Fit</div>
                          <div className={`text-sm font-bold uppercase tracking-wide ${session.councilDebate.cultureFitAdvisor.stance.includes('no_hire') ? 'text-rose-600' : session.councilDebate.cultureFitAdvisor.stance.includes('leaning') ? 'text-amber-600' : 'text-emerald-600'}`}>
                            {session.councilDebate.cultureFitAdvisor.stance.replace(/_/g, ' ')}
                          </div>
                        </div>
                      </div>
                      <p className="text-slate-600 text-[14px] leading-relaxed font-medium">&quot;{session.councilDebate.cultureFitAdvisor.reasoning}&quot;</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Cultural Traits */}
            {session.culturalTraits && session.culturalTraits.length > 0 && (
              <div className="space-y-6">
                <div className="flex items-center gap-4">
                  <h4 className="text-[1.5rem] font-serif text-[#111111] leading-relaxed">Cultural & Behavioral Traits</h4>
                  <div className="h-px flex-1 bg-slate-100"></div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {session.culturalTraits.map((trait, idx: number) => (
                    <div key={idx} className="bg-white border border-slate-100 rounded-[24px] p-8 shadow-sm relative overflow-hidden group/trait">
                      <div className="absolute inset-0 bg-gradient-to-br from-sky-50/50 to-transparent opacity-0 group-hover/trait:opacity-100 transition-opacity duration-500" />
                      <div className="relative z-10">
                        <div className="flex items-center justify-between mb-4">
                          <div className="text-sm font-bold text-[#111111] uppercase tracking-wide">{trait.trait}</div>
                          <div className="text-sm font-mono font-bold text-sky-500 bg-sky-50 px-3 py-1 rounded-full"><AnimatedCounter value={trait.score} /> / 100</div>
                        </div>
                        <p className="text-slate-600 text-[14px] leading-relaxed font-medium italic">&quot;{trait.evidence}&quot;</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Gap Analysis */}
            <KnowledgeMatchLoader session={session} />

            {/* QA Review */}
            {session.qaReview && session.qaReview.map((qa, idx: number) => (
              <div key={idx} className="space-y-8">
                <h4 className="text-[1.5rem] font-serif text-[#111111] leading-relaxed max-w-[65ch]">
                  <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-slate-200/50 text-slate-500 font-mono text-sm mr-4 align-middle">
                    {(idx + 1).toString()}
                  </span> 
                  {qa.question}
                </h4>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  {/* Your Answer Panel */}
                  <div className="bg-white border border-slate-100 rounded-[32px] p-10 shadow-[0_8px_30px_rgb(0,0,0,0.03)] flex flex-col relative overflow-hidden group/answer">
                    <div className="absolute inset-0 bg-gradient-to-b from-white to-slate-50/50 opacity-0 group-hover/answer:opacity-100 transition-opacity duration-500" />
                    <div className="relative z-10">
                      <div className="font-bold text-[11px] text-slate-400 tracking-widest uppercase mb-8 flex items-center gap-3">
                        <span className="w-2 h-2 rounded-full bg-slate-300"></span> 
                        Original Delivery
                      </div>
                      <p className="text-slate-600 mb-10 font-medium leading-relaxed text-[1.1rem]">&quot;{qa.userAnswer}&quot;</p>
                      
                      <div className="bg-rose-50/80 backdrop-blur-md rounded-[24px] p-8 border border-rose-100 mt-auto shadow-inner">
                        <div className="text-rose-600 text-[11px] font-bold font-mono tracking-widest uppercase mb-4 flex items-center gap-2">
                          Diagnostic
                        </div>
                        <TextReveal text={qa.flaws} className="text-rose-900/80 text-[15px] font-medium leading-relaxed" />
                      </div>
                    </div>
                  </div>

                  {/* Recommended STAR Panel */}
                  <div className="bg-[#111111] border border-slate-800 rounded-[32px] p-10 shadow-[0_20px_40px_rgba(0,0,0,0.1)] relative overflow-hidden group/target">
                    <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/10 to-transparent opacity-0 group-hover/target:opacity-100 transition-opacity duration-700" />
                    <div className="relative z-10">
                      <div className="font-bold text-[11px] text-slate-400 tracking-widest uppercase mb-8 flex items-center gap-3">
                        <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_12px_rgba(52,211,153,0.5)] animate-pulse"></span> 
                        Target Response
                      </div>
                      <TextReveal text={qa.perfectRewrite} className="text-slate-300 leading-relaxed font-light text-[1.1rem]" delay={0.2} />
                    </div>
                  </div>
                </div>
              </div>
            ))}

            {/* Timeline Section */}
            {session.timelineEvents && session.timelineEvents.length > 0 && (
              <div className="pt-8 mt-12 border-t border-slate-100/60">
                <h3 className="font-serif text-[2.5rem] tracking-tight text-[#111111] leading-none mb-8">
                  Session Timeline
                </h3>
                <InterviewTimeline events={session.timelineEvents} />
              </div>
            )}
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
