"use client";

import React, { useEffect, useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { db, Interview } from "@/lib/db";
import { motion, AnimatePresence } from "framer-motion";
import { CaretLeft, ChatCircleDots, WarningCircle, CheckCircle, Robot, User, UsersThree, Star, Lightbulb, UserList, Users, DownloadSimple } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Shimmer } from "@/components/ui/shimmer";
import { ReplayTimeline } from "@/components/interview/ReplayTimeline";
import { SpotlightCard } from "@/components/ui/spotlight-card";
import { exportInterviewToMarkdown, downloadFile } from "@/lib/utils/export";
import { PrintLayout } from "@/components/interview/PrintLayout";

type TabId = 'diagnostic' | 'council' | 'culture';

export default function ReplayPage() {
  const { id } = useParams();
  const router = useRouter();
  const [interview, setInterview] = useState<Interview | null>(null);
  const [loading, setLoading] = useState(true);
  
  // Replay state
  const [isPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0); // in ms
  const [activeMessageIndex, setActiveMessageIndex] = useState(-1);
  const [selectedQAIndex, setSelectedQAIndex] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<TabId>('diagnostic');
  
  const transcriptRef = useRef<HTMLDivElement>(null);
  const playIntervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (id) {
      db.interviews.get(parseInt(id as string, 10)).then((data) => {
        setInterview(data || null);
        setLoading(false);
      });
    }
  }, [id]);

  const getQAMatchForMessage = (messageContent: string, role: string) => {
    if (role !== 'user' || !interview?.qaReview) return null;
    
    const normalizedMsg = messageContent.toLowerCase().trim();
    const matchIndex = interview.qaReview.findIndex(qa => 
      qa.userAnswer.toLowerCase().trim() === normalizedMsg ||
      qa.userAnswer.toLowerCase().includes(normalizedMsg) ||
      normalizedMsg.includes(qa.userAnswer.toLowerCase())
    );
    
    return matchIndex !== -1 ? { qa: interview.qaReview[matchIndex], index: matchIndex } : null;
  };

  useEffect(() => {
    if (isPlaying && interview?.transcript) {
      playIntervalRef.current = setInterval(() => {
        setCurrentTime(prev => prev + 100);
      }, 100);
    } else {
      if (playIntervalRef.current) clearInterval(playIntervalRef.current);
    }
    
    return () => {
      if (playIntervalRef.current) clearInterval(playIntervalRef.current);
    };
  }, [isPlaying, interview]);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#FDFBF7]">
        <Shimmer className="w-64 h-64 rounded-full" />
      </div>
    );
  }

  if (!interview) {
    return (
      <div className="flex flex-col h-screen items-center justify-center bg-[#FDFBF7] text-center px-4">
        <WarningCircle className="w-16 h-16 text-slate-300 mb-4" />
        <h1 className="text-2xl font-serif text-slate-800 mb-2">Interview Not Found</h1>
        <p className="text-slate-500 mb-6">This session may have been deleted or doesn&apos;t exist.</p>
        <Button onClick={() => router.push("/dashboard")}>Return to Dashboard</Button>
      </div>
    );
  }

  const handleMessageClick = (msgContent: string, role: string, index: number) => {
    setActiveMessageIndex(index);
    const match = getQAMatchForMessage(msgContent, role);
    if (match) {
      setSelectedQAIndex(match.index);
      setActiveTab('diagnostic'); // Switch to diagnostic tab when clicking a specific message
    } else {
      setSelectedQAIndex(null);
    }
  };

  const tabs: { id: TabId; label: string; icon: React.ReactNode }[] = [
    { id: 'diagnostic', label: 'Diagnostics', icon: <Robot className="w-4 h-4" /> },
    { id: 'council', label: 'Council Debate', icon: <UsersThree className="w-4 h-4" /> },
    { id: 'culture', label: 'Cultural Traits', icon: <Star className="w-4 h-4" /> },
  ];

  return (
    <>
    <div className="flex flex-col h-screen bg-[#FDFBF7] text-slate-800 font-sans overflow-hidden print:hidden">
      {/* Background ambient mesh */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-40">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-blue-200/30 blur-[100px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-teal-200/30 blur-[100px]" />
      </div>

      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 glass shrink-0 z-20 border-b border-white/40">
        <div className="flex items-center gap-4">
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => router.push("/dashboard")}
            className="rounded-full hover:bg-slate-100/50 text-slate-500 transition-colors no-print"
            aria-label="返回控制台"
          >
            <CaretLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="font-serif text-xl font-medium tracking-tight text-slate-900">{interview.title}</h1>
            <p className="text-xs font-mono text-slate-500">{new Date(interview.createdAt).toLocaleString()}</p>
          </div>
        </div>
        
        <div className="flex items-center gap-3 no-print">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => {
              const md = exportInterviewToMarkdown(interview);
              downloadFile(md, `${(interview.title || "Interview").replace(/\s+/g, "_")}_Report.md`);
            }} 
            className="gap-2 bg-white/50 border-white/60 hover:bg-white/80"
          >
            <DownloadSimple className="w-4 h-4" /> Export MD
          </Button>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => window.print()} 
            className="gap-2 bg-white/50 border-white/60 hover:bg-white/80"
          >
            <DownloadSimple className="w-4 h-4" /> Export PDF
          </Button>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex flex-1 overflow-y-auto lg:overflow-hidden p-4 gap-4 z-10 relative flex-col lg:flex-row">
        
        {/* Left Panel: Transcript */}
        <div className="flex-none lg:flex-[3] min-h-[500px] lg:min-h-0 flex flex-col glass-card rounded-3xl overflow-hidden relative border border-white/60 shadow-sm">
          <div className="px-6 py-4 border-b border-white/40 bg-white/30 backdrop-blur-md flex justify-between items-center z-10">
            <h2 className="text-sm font-bold text-slate-600 uppercase tracking-widest font-mono flex items-center gap-2">
              <ChatCircleDots className="w-4 h-4" /> Transcript
            </h2>
            <span className="text-xs text-slate-400">Click user messages to see analysis</span>
          </div>
          
          <div className="flex-1 overflow-y-auto p-6 space-y-6 scroll-smooth" ref={transcriptRef} role="log" aria-live="polite">
            {interview.transcript && interview.transcript.length > 0 ? (
              interview.transcript.map((msg, idx) => {
                const isUser = msg.role === 'user';
                const isActive = activeMessageIndex === idx;
                const hasMatch = isUser && getQAMatchForMessage(msg.content, msg.role) !== null;

                return (
                  <motion.div 
                    key={msg.id || idx}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: Math.min(idx * 0.02, 0.5), type: "spring", stiffness: 300, damping: 30 }}
                    className={`flex flex-col ${isUser ? 'items-end' : 'items-start'} group transform-gpu`}
                  >
                    <div className="flex items-center gap-2 mb-1.5 px-1">
                      {isUser ? (
                        <>
                          <span className="text-[10px] uppercase tracking-widest text-slate-400 font-semibold">Candidate</span>
                          <User className="w-3.5 h-3.5 text-slate-400" />
                        </>
                      ) : (
                        <>
                          <Robot className="w-3.5 h-3.5 text-sky-400" />
                          <span className="text-[10px] uppercase tracking-widest text-sky-400 font-semibold">Interve AI</span>
                        </>
                      )}
                    </div>
                    
                    <div 
                      onClick={() => handleMessageClick(msg.content, msg.role, idx)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          handleMessageClick(msg.content, msg.role, idx);
                        }
                      }}
                      role="button"
                      tabIndex={0}
                      aria-pressed={isActive}
                      aria-label={`${isUser ? '候选人' : 'AI'} 消息: ${msg.content.substring(0, 30)}... 点击查看诊断分析`}
                      className={`relative px-5 py-3.5 max-w-[85%] text-[14.5px] leading-relaxed transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 ${
                        isUser 
                          ? isActive 
                            ? 'bg-zinc-900 text-white rounded-[20px] rounded-br-sm shadow-md border border-zinc-700'
                            : hasMatch
                              ? 'bg-zinc-800 text-white rounded-[20px] rounded-br-sm border border-white/10 hover:bg-zinc-700 hover:shadow-md'
                              : 'bg-zinc-700 text-slate-100 rounded-[20px] rounded-br-sm border border-white/5 opacity-80'
                          : 'glass border border-white/50 text-slate-800 rounded-[20px] rounded-bl-sm font-medium shadow-sm'
                      }`}
                    >
                      {msg.content}
                      
                      {/* Annotation Indicator */}
                      {isUser && hasMatch && !isActive && (
                        <div className="absolute -left-3 -top-3 bg-amber-500 text-white w-6 h-6 rounded-full flex items-center justify-center shadow-sm border-2 border-white transform scale-75 group-hover:scale-100 transition-transform">
                          <WarningCircle weight="bold" className="w-3.5 h-3.5" />
                        </div>
                      )}
                    </div>
                  </motion.div>
                );
              })
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-slate-400 opacity-70">
                <ChatCircleDots className="w-12 h-12 mb-4 text-slate-300" />
                <p>No transcript data available for this session.</p>
              </div>
            )}
          </div>
        </div>

        {/* Right Panel: Tabs for Annotations, Council, Culture */}
        <div className="flex-none lg:flex-[2] min-h-[500px] lg:min-h-0 flex flex-col glass-heavy rounded-3xl overflow-hidden relative shadow-lg border border-white/70">
          
          <div className="px-2 pt-2 border-b border-white/40 bg-white/40 backdrop-blur-md relative z-10">
            <div className="flex space-x-1" role="tablist">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  id={`tab-${tab.id}`}
                  role="tab"
                  aria-selected={activeTab === tab.id}
                  aria-controls={`panel-${tab.id}`}
                  onClick={() => setActiveTab(tab.id)}
                  className={`relative px-4 py-3 text-xs font-bold uppercase tracking-widest font-mono flex items-center gap-2 rounded-t-xl transition-colors outline-none focus-visible:bg-white/50 ${
                    activeTab === tab.id ? "text-sky-600" : "text-slate-500 hover:text-slate-700 hover:bg-white/20"
                  }`}
                >
                  {tab.icon}
                  {tab.label}
                  {activeTab === tab.id && (
                    <motion.div
                      layoutId="activeReplayTab"
                      className="absolute bottom-0 left-0 right-0 h-0.5 bg-sky-500"
                      transition={{ type: "spring", stiffness: 500, damping: 30 }}
                    />
                  )}
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-6 relative z-10" role="tabpanel">
            <AnimatePresence mode="wait">
              
              {/* DIAGNOSTIC TAB */}
              {activeTab === 'diagnostic' && (
                <motion.div
                  key="diagnostic"
                  id="panel-diagnostic"
                  role="tabpanel"
                  aria-labelledby="tab-diagnostic"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.2 }}
                  className="h-full"
                >
                  {selectedQAIndex !== null && interview.qaReview ? (
                    <div className="space-y-6">
                      <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/60 backdrop-blur-sm text-sky-600 rounded-full text-[10px] font-bold font-mono tracking-widest border border-sky-100 shadow-sm">
                        QA Pair {selectedQAIndex + 1} of {interview.qaReview.length}
                      </div>

                      {/* Diagnostic / Flaws */}
                      <SpotlightCard className="bg-white/50 border border-rose-100/50 p-5 rounded-2xl shadow-sm group">
                        <h3 className="text-[11px] font-bold text-rose-500 uppercase tracking-widest font-mono flex items-center gap-2 mb-3">
                          <WarningCircle className="w-4 h-4" weight="fill" /> Delivery Flaws
                        </h3>
                        <div className="text-rose-900/80 leading-relaxed font-medium text-[14px]">
                          {interview.qaReview[selectedQAIndex].flaws}
                        </div>
                      </SpotlightCard>

                      {/* Perfect Rewrite */}
                      <SpotlightCard className="bg-white/50 border border-emerald-100/50 p-5 rounded-2xl shadow-sm group">
                        <h3 className="text-[11px] font-bold text-emerald-600 uppercase tracking-widest font-mono flex items-center gap-2 mb-3">
                          <CheckCircle className="w-4 h-4" weight="fill" /> Target Response
                        </h3>
                        <div className="text-emerald-900/80 leading-relaxed font-medium text-[14px]">
                          {interview.qaReview[selectedQAIndex].perfectRewrite}
                        </div>
                      </SpotlightCard>
                      
                      {/* Context Question Reference */}
                      <div className="pt-4 border-t border-white/40">
                        <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest font-mono mb-2">Original Question Context</h3>
                        <p className="text-[13px] text-slate-600 italic">&quot;{interview.qaReview[selectedQAIndex].question}&quot;</p>
                      </div>
                    </div>
                  ) : (
                    <div className="h-full flex flex-col items-center justify-center text-center text-slate-400">
                      <div className="w-16 h-16 rounded-2xl bg-white/50 border border-white flex items-center justify-center mb-4 shadow-sm">
                        <Robot className="w-8 h-8 text-sky-300" />
                      </div>
                      <h3 className="font-serif text-xl text-slate-700 mb-2">Select a response</h3>
                      <p className="max-w-[250px] leading-relaxed text-xs">
                        Click on any of your highlighted answers in the transcript to view detailed diagnostic improvements.
                      </p>
                    </div>
                  )}
                </motion.div>
              )}

              {/* COUNCIL DEBATE TAB */}
              {activeTab === 'council' && (
                <motion.div
                  key="council"
                  id="panel-council"
                  role="tabpanel"
                  aria-labelledby="tab-council"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.2 }}
                  className="space-y-4"
                >
                  {interview.councilDebate ? (
                    <>
                      <div className="mb-6">
                        <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest font-mono mb-2">Synthesis</h3>
                        <p className="text-sm text-slate-700 leading-relaxed bg-white/40 p-4 rounded-2xl border border-white shadow-sm">
                          {interview.verdictRationale || "The council has debated your performance across technical, HR, and cultural dimensions."}
                        </p>
                      </div>

                      {/* Technical Advisor */}
                      <SpotlightCard className="p-4 rounded-2xl border border-white/50 bg-white/30 backdrop-blur-sm">
                        <div className="flex items-start gap-4">
                          <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center shrink-0 border border-blue-200">
                            <Lightbulb className="w-5 h-5 text-blue-600" weight="duotone" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <h4 className="text-sm font-bold text-slate-800">Technical Advisor</h4>
                              <span className="text-[9px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 border border-blue-100">
                                {interview.councilDebate.technicalAdvisor.stance.replace(/_/g, ' ')}
                              </span>
                            </div>
                            <p className="text-sm text-slate-600 leading-relaxed">
                              {interview.councilDebate.technicalAdvisor.reasoning}
                            </p>
                          </div>
                        </div>
                      </SpotlightCard>

                      {/* HR Advisor */}
                      <SpotlightCard className="p-4 rounded-2xl border border-white/50 bg-white/30 backdrop-blur-sm">
                        <div className="flex items-start gap-4">
                          <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center shrink-0 border border-amber-200">
                            <UserList className="w-5 h-5 text-amber-600" weight="duotone" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <h4 className="text-sm font-bold text-slate-800">HR Advisor</h4>
                              <span className="text-[9px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-50 text-amber-600 border border-amber-100">
                                {interview.councilDebate.hrAdvisor.stance.replace(/_/g, ' ')}
                              </span>
                            </div>
                            <p className="text-sm text-slate-600 leading-relaxed">
                              {interview.councilDebate.hrAdvisor.reasoning}
                            </p>
                          </div>
                        </div>
                      </SpotlightCard>

                      {/* Culture Fit Advisor */}
                      <SpotlightCard className="p-4 rounded-2xl border border-white/50 bg-white/30 backdrop-blur-sm">
                        <div className="flex items-start gap-4">
                          <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center shrink-0 border border-emerald-200">
                            <Users className="w-5 h-5 text-emerald-600" weight="duotone" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <h4 className="text-sm font-bold text-slate-800">Culture Fit Advisor</h4>
                              <span className="text-[9px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-100">
                                {interview.councilDebate.cultureFitAdvisor.stance.replace(/_/g, ' ')}
                              </span>
                            </div>
                            <p className="text-sm text-slate-600 leading-relaxed">
                              {interview.councilDebate.cultureFitAdvisor.reasoning}
                            </p>
                          </div>
                        </div>
                      </SpotlightCard>
                    </>
                  ) : (
                    <div className="h-full flex flex-col items-center justify-center text-center text-slate-400 py-12">
                      <UsersThree className="w-12 h-12 text-slate-300 mb-4" />
                      <p className="text-sm">Council debate data is not available for this session.</p>
                    </div>
                  )}
                </motion.div>
              )}

              {/* CULTURE TAB */}
              {activeTab === 'culture' && (
                <motion.div
                  key="culture"
                  id="panel-culture"
                  role="tabpanel"
                  aria-labelledby="tab-culture"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.2 }}
                  className="space-y-4"
                >
                  {interview.culturalTraits && interview.culturalTraits.length > 0 ? (
                    interview.culturalTraits.map((trait, idx) => (
                      <SpotlightCard key={idx} className="p-5 rounded-2xl border border-white/50 bg-white/30 backdrop-blur-sm flex flex-col gap-3">
                        <div className="flex justify-between items-center">
                          <h4 className="text-[13px] font-bold text-slate-800 font-mono tracking-tight">{trait.trait}</h4>
                          <span className="text-[11px] font-bold text-sky-600 bg-sky-50 px-2 py-0.5 rounded-full border border-sky-100">
                            {trait.score}/100
                          </span>
                        </div>
                        {/* Progress Bar */}
                        <div className="w-full h-1.5 bg-slate-200/50 rounded-full overflow-hidden">
                          <motion.div 
                            initial={{ width: 0 }}
                            animate={{ width: `${trait.score}%` }}
                            transition={{ type: "spring", stiffness: 50, damping: 15, delay: idx * 0.1 }}
                            className="h-full bg-gradient-to-r from-sky-400 to-teal-400"
                          />
                        </div>
                        <p className="text-xs text-slate-600 mt-1 italic">&quot;{trait.evidence}&quot;</p>
                      </SpotlightCard>
                    ))
                  ) : (
                    <div className="h-full flex flex-col items-center justify-center text-center text-slate-400 py-12">
                      <Star className="w-12 h-12 text-slate-300 mb-4" />
                      <p className="text-sm">Cultural traits data is not available for this session.</p>
                    </div>
                  )}
                </motion.div>
              )}

            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* Bottom Timeline */}
      <div className="z-20 bg-white/30 backdrop-blur-lg border-t border-white/40 shadow-[0_-4px_20px_rgba(0,0,0,0.02)] no-print">
        <ReplayTimeline 
          events={interview.timelineEvents} 
          currentTime={currentTime}
          duration={600000} // Fake duration
          onSeek={(time) => {
            setCurrentTime(time);
          }}
        />
      </div>
    </div>
    
    <PrintLayout interview={interview} />
    </>
  );
}
