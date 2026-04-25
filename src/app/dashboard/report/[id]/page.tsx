"use client";

import React, { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { db, type Interview } from "@/lib/db";
import { motion } from "framer-motion";
import { 
  ArrowLeft, FileText, CheckCircle, XCircle, WarningCircle, 
  Lightbulb, ShieldCheck, UsersThree, ChartLineUp, Clock, 
  Quotes, Code, Handshake
} from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, Radar, Tooltip as RechartsTooltip } from "recharts";
import { DynamicLoader } from "@/components/ui/DynamicLoader";
import { ReplayTimeline } from "@/components/interview/ReplayTimeline";
import { BookOpen, ChatTeardropText, Compass, Users } from "@phosphor-icons/react";

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
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 gap-4">
        <WarningCircle className="w-12 h-12 text-rose-500" />
        <h2 className="text-xl font-bold text-slate-800">报告加载失败</h2>
        <p className="text-slate-500">{error || "未找到对应的面试记录"}</p>
        <Button onClick={() => router.push("/dashboard")} variant="outline">
          返回控制台
        </Button>
      </div>
    );
  }

  const { radarScores, councilDebate, qaReview, hireVerdict, verdictRationale, culturalTraits, timelineEvents, trainingRoadmap, transcript } = interview;

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

  const radarData = radarScores ? [
    { subject: '逻辑思维 (Logic)', A: radarScores.logic || 0, fullMark: 100 },
    { subject: '表达沟通 (Expression)', A: radarScores.expression || 0, fullMark: 100 },
    { subject: '专业度 (Professionalism)', A: radarScores.professionalism || 0, fullMark: 100 },
    { subject: '自信心 (Confidence)', A: radarScores.confidence || 0, fullMark: 100 },
    { subject: '抗压能力 (Pressure)', A: radarScores.pressure || 0, fullMark: 100 },
  ] : [];

  const getVerdictStyle = (verdict?: string) => {
    switch (verdict) {
      case "strong_hire": return "bg-emerald-500/10 text-emerald-600 border-emerald-200";
      case "hire": return "bg-emerald-400/10 text-emerald-600 border-emerald-200";
      case "leaning_hire": return "bg-teal-500/10 text-teal-600 border-teal-200";
      case "leaning_no_hire": return "bg-amber-500/10 text-amber-600 border-amber-200";
      case "no_hire": return "bg-rose-500/10 text-rose-600 border-rose-200";
      default: return "bg-slate-100 text-slate-600 border-slate-200";
    }
  };

  const getVerdictLabel = (verdict?: string) => {
    switch (verdict) {
      case "strong_hire": return "Strong Hire (强烈推荐)";
      case "hire": return "Hire (推荐录用)";
      case "leaning_hire": return "Leaning Hire (倾向录用)";
      case "leaning_no_hire": return "Leaning No Hire (倾向不录用)";
      case "no_hire": return "No Hire (不推荐录用)";
      default: return "Pending (评估中)";
    }
  };

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
              <h1 className="text-4xl font-serif font-bold text-slate-900 tracking-tight">面试综合评估报告</h1>
              <p className="text-slate-500 mt-2 flex items-center gap-2">
                <Clock className="w-4 h-4" /> 
                {new Date(interview.createdAt).toLocaleString()} | 职位: {interview.title || '未知'}
              </p>
            </div>
            
            <div className={`px-6 py-3 rounded-2xl border flex items-center gap-3 backdrop-blur-md shadow-sm ${getVerdictStyle(hireVerdict)}`}>
              {hireVerdict?.includes("hire") && !hireVerdict.includes("no") ? (
                <CheckCircle className="w-6 h-6" weight="fill" />
              ) : (
                <XCircle className="w-6 h-6" weight="fill" />
              )}
              <div>
                <p className="text-xs font-bold uppercase tracking-wider opacity-80">Final Verdict</p>
                <p className="text-lg font-bold">{getVerdictLabel(hireVerdict)}</p>
              </div>
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
                <h2 className="text-xl font-bold text-slate-800">总评分析 (Verdict Rationale)</h2>
              </div>
              <p className="text-slate-700 leading-relaxed text-lg">
                {verdictRationale || "暂无总评数据。"}
              </p>

              <DeliveryCoach stats={interview.deliveryStats} jobTitle={interview.title} />
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

          {/* Council Debate */}
          {councilDebate && (
            <motion.div variants={fadeIn} className="bg-white/70 backdrop-blur-xl border border-white rounded-[2rem] p-8 shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
              <div className="flex items-center gap-3 mb-8">
                <div className="p-2.5 bg-slate-900 text-white rounded-xl shadow-md">
                  <UsersThree className="w-5 h-5" weight="fill" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-slate-800">招聘委员会决议 (Council Debate)</h2>
                  <p className="text-sm text-slate-500">多维度AI考官的独立评估意见</p>
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
                <h2 className="text-xl font-bold text-slate-800">行为与文化契合度 (Cultural Traits)</h2>
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

function DeliveryCoach({ stats, jobTitle }: { stats?: { wpm: number; fillerWords: number }, jobTitle?: string }) {
  if (!stats) return null;
  
  const wpm = stats.wpm || 0;
  const filler = stats.fillerWords || 0;
  
  const isSenior = jobTitle && /(senior|lead|manager|director|principal|高级|专家|主管|总监)/i.test(jobTitle);

  const advices = [];
  
  // WPM Evaluation
  if (wpm > 160) {
    if (isSenior) {
      advices.push("语速过快：作为资深职位候选人，过快的语速可能会削弱你的权威感和沉稳度。建议在表达战略或关键决策时有意放慢节奏。");
    } else {
      advices.push("语速过快：这可能会让听众感到压迫，也容易暴露出紧张情绪。建议在表达关键点时适当停顿。");
    }
  } else if (wpm > 0 && wpm < 100) {
    if (isSenior) {
      advices.push("语速较慢：虽然沉稳，但过慢的语速可能会导致沟通效率下降。建议在阐述具体执行细节时适当加快节奏。");
    } else {
      advices.push("语速较慢：这可能给人缺乏自信或准备不足的印象。建议进行模拟录音训练，适当提升表达流畅度。");
    }
  } else if (wpm > 0) {
    advices.push("语速适中：保持了很好的表达节奏，给考官留下稳健的印象。");
  }

  // Filler Words Evaluation
  if (filler > 10) {
    if (isSenior) {
      advices.push(`口头禅过多 (共${filler}次)：对于高级职位而言，过多的“然后”、“就是”会严重影响表达的专业度和说服力。请务必用停顿代替无意识的填充词。`);
    } else {
      advices.push("口头禅过多：频繁使用“然后”、“就是”等词语会削弱表达的专业度。建议用短暂的停顿（Silence）来代替无意义的填充词。");
    }
  } else if (filler > 5) {
    advices.push("口头禅一般：偶有口头禅，属于正常范围，但仍有精进空间，可尝试更有意识地控制。");
  } else {
    advices.push("口头禅控制良好：表达清晰连贯，未出现明显的口语化冗余。");
  }

  return (
    <div className="mt-8 pt-6 border-t border-slate-100">
      <div className="flex gap-8 mb-6">
        <div>
          <p className="text-xs text-slate-400 font-bold uppercase mb-1">语速 (WPM)</p>
          <p className="text-2xl font-serif text-slate-800">{wpm}</p>
        </div>
        <div>
          <p className="text-xs text-slate-400 font-bold uppercase mb-1">口头禅 (Filler Words)</p>
          <p className="text-2xl font-serif text-slate-800">{filler}</p>
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
