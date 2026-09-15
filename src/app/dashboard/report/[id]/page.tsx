"use client";

import React, { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { db, type Interview } from "@/lib/db";
import { motion } from "framer-motion";
import { 
  ArrowLeft, FileText, CheckCircle, XCircle,
  Lightbulb, ShieldCheck, UsersThree, ChartLineUp, Clock,
  Quotes, Code, Handshake
} from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/data";
import { ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, Radar, Tooltip as RechartsTooltip } from "recharts";
import { DynamicLoader } from "@/components/ui/DynamicLoader";
import { ReplayTimeline } from "@/components/interview/ReplayTimeline";
import { BookOpen, ChatTeardropText, Compass, Users } from "@phosphor-icons/react";
import { toEvaluationView } from "@/lib/eval-compat";
import { retryPracticeHref } from "@/lib/retry-link";
import { ReadinessBadge, ReadinessDisclaimer, LegacyBanner, DimensionsSection, StrengthsDrills, DrillPlan } from "@/components/evaluation/EvaluationView";

const renderFlawsWithSTAR = (flawsText: string) => {
  if (!flawsText) return null;
  const starRegex = /\[(S|T|A|R):\s*([^\]]+)\]/g;
  const stars: { letter: string, status: string, isSuccess: boolean }[] = [];
  
  const cleanText = flawsText.replace(starRegex, '').trim();
  const matches = [...flawsText.matchAll(starRegex)];
  
  matches.forEach(m => {
    const statusStr = m[2].trim();
    const isSuccess = ['✔️', '✅', '✓', 'yes', 'true', 'ok', '1'].includes(statusStr.toLowerCase());
    stars.push({ letter: m[1], status: statusStr, isSuccess });
  });

  const getStarLabel = (letter: string) => {
    switch(letter) {
      case 'S': return 'Situation (情境)';
      case 'T': return 'Task (任务)';
      case 'A': return 'Action (行动)';
      case 'R': return 'Result (结果)';
      default: return letter;
    }
  };

  if (stars.length === 0) {
    return (
      <div className="text-sm text-rose-700">
        <span className="font-bold mr-2">发现的问题 (Flaws):</span>
        {flawsText}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {stars.map((star, i) => (
          <div key={i} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border ${star.isSuccess ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-rose-50 text-rose-700 border-rose-200'}`}>
            <span>{getStarLabel(star.letter)}:</span>
            {star.isSuccess ? <CheckCircle weight="fill" className="w-4 h-4" /> : <XCircle weight="fill" className="w-4 h-4" />}
          </div>
        ))}
      </div>
      {cleanText && (
         <div className="text-sm text-slate-700 bg-white/60 p-4 rounded-xl border border-slate-100">
           <span className="font-bold text-slate-800 mr-2">STAR 深度解析:</span>
           {cleanText}
         </div>
      )}
    </div>
  );
};

const fadeIn = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6 } }
};

const staggerContainer = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.1 }
  }
};

export default function InterviewReportPage() {
  const { id } = useParams();
  const router = useRouter();
  const [interview, setInterview] = useState<Interview | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [currentTimelineTime, setCurrentTimelineTime] = useState(0);

  useEffect(() => {
    async function loadInterview() {
      try {
        const data = await db.interviews.get(Number(id));
        if (data) {
          setInterview(data);
        } else {
          setError("Interview not found");
        }
      } catch {
        setError("Failed to load interview report");
      } finally {
        setIsLoading(false);
      }
    }
    loadInterview();
  }, [id]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <DynamicLoader phrases={["正在生成深度分析报告..."]} />
      </div>
    );
  }

  if (error || !interview) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 px-4">
        <ErrorState
          title="报告加载失败"
          message={error || "未找到对应的面试记录"}
          backHref="/dashboard"
          backLabel="返回控制台"
        />
      </div>
    );
  }

  const { radarScores, councilDebate, qaReview, verdictRationale, culturalTraits, timelineEvents, trainingRoadmap, transcript } = interview;
  // Phase 4: single view model over V2 (evidence-grounded) and legacy rows.
  const view = toEvaluationView(interview);

  const timelineDuration = timelineEvents && timelineEvents.length > 0 
    ? timelineEvents[timelineEvents.length - 1].timestamp + 10000 // Add 10s buffer
    : 600000;

  const handleSeek = (timestamp: number) => {
    setCurrentTimelineTime(timestamp);
    // Attempt to scroll to the corresponding transcript message if it exists
    const element = document.getElementById(`transcript-time-${timestamp}`);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

  // Radar: V2 dimensions (up to 6) or legacy 5-subject scores. Historical
  // bodyLanguage values render if present; nothing new is written (Phase 3).
  const radarData = view.kind === "v2"
    ? view.dimensions.slice(0, 6).map((d) => ({ subject: d.name, A: d.score100, fullMark: 100 }))
    : radarScores ? [
      { subject: '逻辑思维 (Logic)', A: radarScores.logic || 0, fullMark: 100 },
      { subject: '表达沟通 (Expression)', A: radarScores.expression || 0, fullMark: 100 },
      { subject: '专业度 (Professionalism)', A: radarScores.professionalism || 0, fullMark: 100 },
      { subject: '自信心 (Confidence)', A: radarScores.confidence || 0, fullMark: 100 },
      { subject: '抗压能力 (Pressure)', A: radarScores.pressure || 0, fullMark: 100 },
    ] : [];

  return (
    <div className="min-h-screen bg-[#FAFAFA] font-sans selection:bg-indigo-100 selection:text-indigo-900 pb-20">
      {/* Background Decor */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-indigo-500/5 blur-[120px] rounded-full" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-violet-500/5 blur-[120px] rounded-full" />
        <div 
          className="absolute inset-0 opacity-[0.015]"
          style={{ backgroundImage: 'radial-gradient(#000 1px, transparent 1px)', backgroundSize: '32px 32px' }}
        />
      </div>

      <main className="max-w-6xl mx-auto px-6 pt-12 relative z-10">
        <motion.div initial="hidden" animate="visible" variants={staggerContainer} className="space-y-8">
          
          {/* Header */}
          <motion.div variants={fadeIn} className="flex items-center justify-between mb-8">
            <div>
              <Button variant="ghost" onClick={() => router.push("/dashboard")} className="mb-4 text-slate-500 hover:text-slate-900 -ml-2">
                <ArrowLeft className="w-4 h-4 mr-2" /> 返回控制台
              </Button>
              <p className="mb-2 font-mono text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">
                Step 3 · Review
              </p>
              <h1 className="text-4xl font-serif font-bold text-slate-900 tracking-tight">面试综合评估报告</h1>
              <p className="text-slate-500 mt-2 flex items-center gap-2">
                <Clock className="w-4 h-4" /> 
                {new Date(interview.createdAt).toLocaleString()} | 职位: {interview.title || '未知'}
              </p>
            </div>
            
            {/* Phase 4: readiness for V2 rows, badged legacy verdicts for history. No hire decisions are produced anymore. */}
            <div>
              <ReadinessBadge view={view} />
              {!view.legacy && <ReadinessDisclaimer />}
            </div>
          </motion.div>

          {/* Replay Timeline */}
          {timelineEvents && timelineEvents.length > 0 && (
            <motion.div variants={fadeIn} className="bg-white/70 backdrop-blur-xl border border-white rounded-[2rem] p-8 shadow-[0_8px_30px_rgb(0,0,0,0.04)] mb-8">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2.5 bg-sky-50 text-sky-600 rounded-xl">
                  <Clock className="w-5 h-5" weight="fill" />
                </div>
                <h2 className="text-xl font-bold text-slate-800">面试时间轴 (Replay Timeline)</h2>
              </div>
              <div className="bg-slate-50/50 rounded-2xl p-6 border border-slate-100">
                <ReplayTimeline 
                  events={timelineEvents} 
                  currentTime={currentTimelineTime} 
                  duration={timelineDuration} 
                  onSeek={handleSeek} 
                />
              </div>
            </motion.div>
          )}

          {/* Rationale & Radar */}
          <motion.div variants={staggerContainer} className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            <motion.div variants={fadeIn} className="lg:col-span-2 bg-white/70 backdrop-blur-xl border border-white rounded-[2rem] p-8 shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl">
                  <FileText className="w-5 h-5" weight="fill" />
                </div>
                <h2 className="text-xl font-bold text-slate-800">总评分析 (Readiness Rationale)</h2>
              </div>
              {view.legacy && <div className="mb-4"><LegacyBanner text={view.disclaimer} /></div>}
              <p className="text-slate-700 leading-relaxed text-lg">
                {view.readinessRationale || verdictRationale || "暂无总评数据。"}
              </p>

              <DeliveryCoach stats={interview.deliveryStats} />
            </motion.div>

            <motion.div variants={fadeIn} className="bg-white/70 backdrop-blur-xl border border-white rounded-[2rem] p-8 shadow-[0_8px_30px_rgb(0,0,0,0.04)] flex flex-col items-center">
              <div className="w-full flex items-center gap-3 mb-2">
                <div className="p-2.5 bg-violet-50 text-violet-600 rounded-xl">
                  <ChartLineUp className="w-5 h-5" weight="fill" />
                </div>
                <h2 className="text-xl font-bold text-slate-800">能力雷达图</h2>
              </div>
              
              <div className="w-full h-[280px] -mt-4">
                {radarData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={280}>
                    <RadarChart cx="50%" cy="50%" outerRadius="70%" data={radarData}>
                      <PolarGrid stroke="#e2e8f0" />
                      <PolarAngleAxis dataKey="subject" tick={{ fill: '#64748b', fontSize: 11, fontWeight: 600 }} />
                      <Radar name="Candidate" dataKey="A" stroke="#8b5cf6" fill="#8b5cf6" fillOpacity={0.3} />
                      <RechartsTooltip 
                        contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1)' }}
                        itemStyle={{ color: '#8b5cf6', fontWeight: 'bold' }}
                      />
                    </RadarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-slate-400">雷达图数据不可用</div>
                )}
              </div>
            </motion.div>
          </motion.div>

          {/* Dimensions (evidence-grounded for V2; transparency notes for legacy) */}
          <motion.div variants={fadeIn} className="bg-white/70 backdrop-blur-xl border border-white rounded-[2rem] p-8 shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2.5 bg-violet-50 text-violet-600 rounded-xl">
                <ChartLineUp className="w-5 h-5" weight="fill" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-slate-800">能力维度评估 (Rubric Dimensions)</h2>
                <p className="text-sm text-slate-500">每个分数都附带原文证据与评估置信度</p>
              </div>
            </div>
            {view.dimensions.length > 0 ? (
              <DimensionsSection view={view} />
            ) : (
              <p className="text-slate-400">暂无维度数据。</p>
            )}
          </motion.div>

          {/* Strengths / gaps / drills (V2 only) */}
          {(view.strengths.length > 0 || view.weaknesses.length > 0 || view.nextDrills.length > 0) && (
            <motion.div variants={fadeIn} className="bg-white/70 backdrop-blur-xl border border-white rounded-[2rem] p-8 shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
              <StrengthsDrills view={view} />
            </motion.div>
          )}

          {/* Drill plan from the curated bank (Phase 7 practice loop) */}
          <motion.div variants={fadeIn}>
            <DrillPlan view={view} />
          </motion.div>

          {/* Council Debate (legacy rows only — preserved history, not produced anymore) */}
          {view.legacy && councilDebate && (
            <motion.div variants={fadeIn} className="bg-white/70 backdrop-blur-xl border border-white rounded-[2rem] p-8 shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
              <div className="flex items-center gap-3 mb-8">
                <div className="p-2.5 bg-slate-900 text-white rounded-xl shadow-md">
                  <UsersThree className="w-5 h-5" weight="fill" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-slate-800">招聘委员会决议 (Council Debate) <span className="text-xs font-bold text-slate-400 align-middle">· 历史评估</span></h2>
                  <p className="text-sm text-slate-500">多维度AI考官的独立评估意见（旧版评估保留，新版已改用证据型维度评估）</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <AdvisorCard 
                  title="Technical Advisor" 
                  icon={<Code className="w-5 h-5" />} 
                  advisor={councilDebate.technicalAdvisor} 
                  color="blue"
                />
                <AdvisorCard 
                  title="HR Advisor" 
                  icon={<UsersThree className="w-5 h-5" />} 
                  advisor={councilDebate.hrAdvisor} 
                  color="emerald"
                />
                <AdvisorCard 
                  title="Culture Fit Advisor" 
                  icon={<Handshake className="w-5 h-5" />} 
                  advisor={councilDebate.cultureFitAdvisor} 
                  color="amber"
                />
              </div>
            </motion.div>
          )}

          {/* Training Roadmap */}
          {trainingRoadmap && (
            <motion.div variants={fadeIn} className="bg-white/70 backdrop-blur-xl border border-white rounded-[2rem] p-8 shadow-[0_8px_30px_rgb(0,0,0,0.04)] col-span-1 lg:col-span-2">
              <h3 className="text-xl font-bold text-slate-800 mb-6 flex items-center gap-3">
                <Compass className="w-6 h-6 text-indigo-500" />
                Personalized Training Roadmap
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Technical Focus */}
                <div className="bg-white/50 rounded-2xl p-6 border border-white/60">
                  <h4 className="font-semibold text-slate-800 flex items-center gap-2 mb-4">
                    <Code className="w-5 h-5 text-blue-500" />
                    Technical Focus
                  </h4>
                  <ul className="space-y-3">
                    {trainingRoadmap.technical.map((item, i) => (
                      <li key={i} className="text-sm text-slate-600 flex items-start gap-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-1.5 flex-shrink-0" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Behavioral Focus */}
                <div className="bg-white/50 rounded-2xl p-6 border border-white/60">
                  <h4 className="font-semibold text-slate-800 flex items-center gap-2 mb-4">
                    <Users className="w-5 h-5 text-emerald-500" />
                    Behavioral Focus
                  </h4>
                  <ul className="space-y-3">
                    {trainingRoadmap.behavioral.map((item, i) => (
                      <li key={i} className="text-sm text-slate-600 flex items-start gap-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-1.5 flex-shrink-0" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Recommended Resources */}
                <div className="bg-white/50 rounded-2xl p-6 border border-white/60">
                  <h4 className="font-semibold text-slate-800 flex items-center gap-2 mb-4">
                    <BookOpen className="w-5 h-5 text-purple-500" />
                    Recommended Resources
                  </h4>
                  <ul className="space-y-3">
                    {trainingRoadmap.resources.map((item, i) => (
                      <li key={i} className="text-sm text-slate-600 flex items-start gap-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-purple-500 mt-1.5 flex-shrink-0" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </motion.div>
          )}

          {/* Cultural Traits */}
          {culturalTraits && culturalTraits.length > 0 && (
            <motion.div variants={fadeIn} className="bg-white/70 backdrop-blur-xl border border-white rounded-[2rem] p-8 shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2.5 bg-orange-50 text-orange-600 rounded-xl">
                  <ShieldCheck className="w-5 h-5" weight="fill" />
                </div>
                <h2 className="text-xl font-bold text-slate-800">行为与文化契合度 (Cultural Traits) <span className="text-xs font-bold text-slate-400 align-middle">· 历史评估</span></h2>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {culturalTraits.map((trait, idx) => (
                  <div key={idx} className="p-5 border border-slate-100 rounded-2xl bg-white/50">
                    <div className="flex justify-between items-center mb-2">
                      <span className="font-bold text-slate-800">{trait.trait}</span>
                      <span className="text-sm font-black text-orange-500">{trait.score}/100</span>
                    </div>
                    <div className="w-full h-1.5 bg-slate-100 rounded-full mb-3 overflow-hidden">
                      <div className="h-full bg-gradient-to-r from-orange-400 to-rose-400 rounded-full" style={{ width: `${trait.score}%` }} />
                    </div>
                    <p className="text-sm text-slate-600 italic">&quot;{trait.evidence}&quot;</p>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {/* QA Review */}
          {qaReview && qaReview.length > 0 && (
            <motion.div variants={fadeIn} className="space-y-6 pt-4">
              <div className="flex items-center gap-3 px-2">
                <div className="p-2.5 bg-sky-50 text-sky-600 rounded-xl">
                  <Quotes className="w-5 h-5" weight="fill" />
                </div>
                <h2 className="text-2xl font-bold text-slate-800">QA 深度解析 (Q&A Review)</h2>
              </div>

              {qaReview.map((qa, index) => (
                <div key={index} className="bg-white/80 backdrop-blur-xl border border-slate-200/60 rounded-[2rem] p-8 shadow-sm">
                  <div className="mb-6">
                    <span className="inline-block px-3 py-1 bg-slate-100 text-slate-600 text-xs font-bold rounded-lg mb-3">Question {index + 1}</span>
                    <h3 className="text-lg font-semibold text-slate-900">{qa.question}</h3>
                    {/* Phase 7: QA → Retry */}
                    <a
                      href={retryPracticeHref(qa.question)}
                      className="inline-block mt-2 text-xs font-bold text-sky-600 hover:text-sky-500 hover:underline"
                    >
                      Retry this question →
                    </a>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                    <div className="p-5 bg-slate-50/80 rounded-2xl border border-slate-100">
                      <div className="flex items-center gap-2 mb-3 text-slate-500">
                        <UsersThree className="w-4 h-4" />
                        <span className="text-xs font-bold uppercase">你的回答</span>
                      </div>
                      <p className="text-slate-700 text-sm leading-relaxed">{qa.userAnswer}</p>
                    </div>
                    <div className="p-5 bg-indigo-50/50 rounded-2xl border border-indigo-100/50">
                      <div className="flex items-center gap-2 mb-3 text-indigo-500">
                        <Lightbulb className="w-4 h-4" weight="fill" />
                        <span className="text-xs font-bold uppercase">完美重写参考</span>
                      </div>
                      <p className="text-slate-700 text-sm leading-relaxed">{qa.perfectRewrite}</p>
                    </div>
                  </div>

                  <div className="p-4 bg-slate-50/50 rounded-xl border border-slate-100/50">
                    {renderFlawsWithSTAR(qa.flaws)}
                  </div>
                </div>
              ))}
            </motion.div>
          )}

          {/* Transcript View */}
          {transcript && transcript.length > 0 && (
            <motion.div variants={fadeIn} className="bg-white/70 backdrop-blur-xl border border-white rounded-[2rem] p-8 shadow-[0_8px_30px_rgb(0,0,0,0.04)] mb-8">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2.5 bg-slate-100 text-slate-600 rounded-xl">
                  <ChatTeardropText className="w-5 h-5" weight="fill" />
                </div>
                <h2 className="text-xl font-bold text-slate-800">完整对话记录 (Transcript)</h2>
              </div>
              <div className="space-y-6 max-h-[500px] overflow-y-auto pr-4 scrollbar-thin scrollbar-thumb-slate-200">
                {transcript.map((msg, index) => {
                  const isUser = msg.role === 'user';
                  // Find if there's a timeline event near this message
                  const relatedEvent = timelineEvents?.find(e => e.messageId === msg.id || e.title.includes(msg.content.substring(0, 10)));
                  
                  return (
                    <div 
                      key={msg.id || index} 
                      id={relatedEvent ? `transcript-time-${relatedEvent.timestamp}` : undefined}
                      className={`flex flex-col ${isUser ? 'items-end' : 'items-start'}`}
                    >
                      <span className="text-[11px] font-bold text-slate-400 mb-1 uppercase tracking-wider">
                        {isUser ? 'You' : 'Interviewer'}
                      </span>
                      <div className={`px-5 py-3.5 rounded-2xl max-w-[85%] ${isUser ? 'bg-indigo-600 text-white rounded-tr-sm' : 'bg-slate-100 text-slate-800 rounded-tl-sm'}`}>
                        <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </motion.div>
          )}

        </motion.div>
      </main>
    </div>
  );
}

function DeliveryCoach({ stats }: {
  stats?: {
    wpm: number; fillerWords: number; interruptions?: number;
    avgAnswerSec?: number; avgRoundTripMs?: number; sttAvgConfidence?: number;
    ttftMs?: number; whisperMs?: number; ttsStartupMs?: number;
  }
}) {
  if (!stats) return null;

  const wpm = stats.wpm || 0;
  const filler = stats.fillerWords || 0;

  const advices = [];

  // Phase 8 (19.3): observable delivery notes only. WPM/filler counts are
  // measurements against a conventional 100–160 band — never evidence of
  // nervousness, confidence, or authority.
  if (wpm > 160) {
    advices.push(`语速 ${wpm} WPM，高于 100–160 参考带。关键论点处有意停顿，听众更容易跟上。`);
  } else if (wpm > 0 && wpm < 100) {
    advices.push(`语速 ${wpm} WPM，低于 100–160 参考带。检查是否有过长停顿或断句，必要时做模拟录音对比。`);
  } else if (wpm > 0) {
    advices.push(`语速 ${wpm} WPM，落在 100–160 参考带内，节奏稳定。`);
  }

  // Filler Words Evaluation
  if (filler > 10) {
    advices.push(`口头禅共 ${filler} 次（参考带 ≤5）。试着用短暂停顿替代无意识的填充词。`);
  } else if (filler > 5) {
    advices.push(`口头禅 ${filler} 次，略高于参考带（≤5），仍有精进空间。`);
  } else {
    advices.push("口头禅控制在参考带内，表达连贯。");
  }

  return (
    <div className="mt-8 pt-6 border-t border-slate-100">
      {/* Phase 8 (19.3): measured values only; "—" when unmeasured. */}
      <div className="flex flex-wrap gap-8 mb-6">
        <div>
          <p className="text-xs text-slate-400 font-bold uppercase mb-1">语速 (WPM)</p>
          <p className="text-2xl font-serif text-slate-800">{wpm}</p>
        </div>
        <div>
          <p className="text-xs text-slate-400 font-bold uppercase mb-1">口头禅 (Filler Words)</p>
          <p className="text-2xl font-serif text-slate-800">{filler}</p>
        </div>
        <div>
          <p className="text-xs text-slate-400 font-bold uppercase mb-1">打断 (Interruptions)</p>
          <p className="text-2xl font-serif text-slate-800">{stats.interruptions ?? "—"}</p>
        </div>
        <div>
          <p className="text-xs text-slate-400 font-bold uppercase mb-1">平均作答 (Avg Answer)</p>
          <p className="text-2xl font-serif text-slate-800">{stats.avgAnswerSec !== undefined ? `${stats.avgAnswerSec}s` : "—"}</p>
        </div>
        <div>
          <p className="text-xs text-slate-400 font-bold uppercase mb-1">平均往返 (Round Trip)</p>
          <p className="text-2xl font-serif text-slate-800">{stats.avgRoundTripMs !== undefined ? `${(stats.avgRoundTripMs / 1000).toFixed(1)}s` : "—"}</p>
        </div>
        <div>
          <p className="text-xs text-slate-400 font-bold uppercase mb-1">STT 置信度</p>
          <p className="text-2xl font-serif text-slate-800">{stats.sttAvgConfidence !== undefined ? stats.sttAvgConfidence.toFixed(2) : "—"}</p>
        </div>
        <div>
          <p className="text-xs text-slate-400 font-bold uppercase mb-1" title="发送到首个 AI 回复耗时">TTFT</p>
          <p className="text-2xl font-serif text-slate-800">{stats.ttftMs !== undefined ? `${(stats.ttftMs / 1000).toFixed(1)}s` : "—"}</p>
        </div>
        <div>
          <p className="text-xs text-slate-400 font-bold uppercase mb-1" title="本地语音转文字耗时">STT 耗时</p>
          <p className="text-2xl font-serif text-slate-800">{stats.whisperMs !== undefined ? `${(stats.whisperMs / 1000).toFixed(1)}s` : "—"}</p>
        </div>
        <div>
          <p className="text-xs text-slate-400 font-bold uppercase mb-1" title="语音请求到首次发声耗时">TTS 启动</p>
          <p className="text-2xl font-serif text-slate-800">{stats.ttsStartupMs !== undefined ? `${(stats.ttsStartupMs / 1000).toFixed(1)}s` : "—"}</p>
        </div>
      </div>
      
      <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
        <h4 className="text-sm font-bold text-slate-700 mb-2 flex items-center gap-2">
          <Lightbulb className="w-4 h-4 text-amber-500" weight="fill" />
          交付与表达反馈
        </h4>
        <ul className="space-y-2">
          {advices.map((adv, idx) => (
            <li key={idx} className="text-sm text-slate-600 flex items-start gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-indigo-400 mt-1.5 flex-shrink-0" />
              <span>{adv}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function AdvisorCard({ title, icon, advisor, color }: { title: string, icon: React.ReactNode, advisor: { stance?: string, reasoning?: string }, color: 'blue' | 'emerald' | 'amber' }) {
  const getVerdictLabel = (verdict: string) => {
    switch (verdict) {
      case "strong_hire": return "Strong Hire";
      case "hire": return "Hire";
      case "leaning_hire": return "Leaning Hire";
      case "leaning_no_hire": return "Leaning No Hire";
      case "no_hire": return "No Hire";
      default: return verdict;
    }
  };

  const isHire = advisor.stance?.includes("hire") && !advisor.stance?.includes("no");
  
  const colorMap = {
    blue: "bg-blue-50 text-blue-600 border-blue-100",
    emerald: "bg-emerald-50 text-emerald-600 border-emerald-100",
    amber: "bg-amber-50 text-amber-600 border-amber-100",
  };

  return (
    <div className="p-6 border border-slate-100 rounded-2xl bg-white shadow-sm flex flex-col">
      <div className="flex items-center gap-2 mb-4">
        <div className={`p-2 rounded-lg ${colorMap[color]}`}>
          {icon}
        </div>
        <h3 className="font-bold text-slate-800">{title}</h3>
      </div>
      
      <div className={`self-start px-3 py-1 rounded-full text-xs font-bold mb-4 flex items-center gap-1.5
        ${isHire ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}
      `}>
        {isHire ? <CheckCircle weight="fill" /> : <XCircle weight="fill" />}
        {getVerdictLabel(advisor.stance || "neutral")}
      </div>

      <p className="text-sm text-slate-600 leading-relaxed flex-1">
        &quot;{advisor.reasoning}&quot;
      </p>
    </div>
  );
}
