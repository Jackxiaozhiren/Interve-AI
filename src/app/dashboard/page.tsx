'use client'

import { useEffect, useState, useCallback } from "react";
import { ProtectedRoute } from "@/components/auth";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { buttonVariants } from "@/components/ui/button";
import { SpotlightCard } from "@/components/ui/spotlight-card";
import { AnimatedCounter } from "@/components/ui/animated-counter";
import { db, type Interview } from "@/lib/db";
import { bentoContainerVariant, bentoCardVariant, fadeUpVariant } from "@/lib/motion";

import { DashboardSkeleton } from "@/components/dashboard/DashboardSkeleton";
import { EmptyDashboardState } from "@/components/dashboard/EmptyDashboardState";
import { SessionDetailModal } from "@/components/dashboard/SessionDetailModal";
import { ContinuousLearning } from "@/components/dashboard/ContinuousLearning";
import { AchievementShowcase } from "@/components/dashboard/AchievementShowcase";
import { GrowthTrendChart, type TrendDataPoint } from "@/components/dashboard/GrowthTrendChart";
import { SkillBreakdownChart, type RadarDataPoint } from "@/components/dashboard/SkillBreakdownChart";
import { SystemTelemetry } from "@/components/dashboard/SystemTelemetry";

import {
  Plus,
  ChartLine,
  Trophy,
  ClockCountdown,
  Target,
  Sparkle,
  TrendUp,
  UserCircle,
  CalendarBlank,
  Play,
} from "@phosphor-icons/react";
import { format } from "date-fns";

export default function DashboardPage() {
  const [sessions, setSessions] = useState<Interview[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedSession, setSelectedSession] = useState<Interview | null>(null);
  const router = useRouter();

  const loadSessions = useCallback(async () => {
    try {
      const data = await db.interviews.orderBy('createdAt').reverse().toArray();
      setSessions(data);
    } catch (error) {
      console.error("Failed to load sessions:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  const completedSessions = sessions.filter(s => s.status === 'completed');
  const totalSessions = sessions.length;
  const avgScore = completedSessions.length > 0
    ? Math.round(completedSessions.reduce((acc, s) => {
        const scores = s.radarScores;
        if (!scores) return acc;
        const vals = [scores.logic, scores.expression, scores.professionalism, scores.confidence, scores.pressure, scores.bodyLanguage].filter(Boolean);
        return acc + (vals.reduce((a, b) => a + b, 0) / vals.length);
      }, 0) / completedSessions.length)
    : 0;

  // Growth trend data
  const trendData: TrendDataPoint[] = completedSessions
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
    .map((s, i) => {
      const scores = s.radarScores;
      const score = scores
        ? Math.round([scores.logic, scores.expression, scores.professionalism, scores.confidence, scores.pressure, scores.bodyLanguage].filter(Boolean).reduce((a, b) => a + b, 0) / [scores.logic, scores.expression, scores.professionalism, scores.confidence, scores.pressure, scores.bodyLanguage].filter(Boolean).length)
        : 0;
      return { name: `Session ${i + 1}`, score, sessionId: String(s.id) };
    });

  // Radar data from latest and first session
  const latestCompleted = completedSessions.length > 0
    ? completedSessions.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0]
    : null;
  const firstCompleted = completedSessions.length > 0
    ? completedSessions.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())[0]
    : null;

  const radarData: RadarDataPoint[] = latestCompleted?.radarScores ? [
    { subject: 'Logic', A: latestCompleted.radarScores.logic || 0, B: firstCompleted?.radarScores?.logic || 0 },
    { subject: 'Expression', A: latestCompleted.radarScores.expression || 0, B: firstCompleted?.radarScores?.expression || 0 },
    { subject: 'Confidence', A: latestCompleted.radarScores.confidence || 0, B: firstCompleted?.radarScores?.confidence || 0 },
    { subject: 'Pressure', A: latestCompleted.radarScores.pressure || 0, B: firstCompleted?.radarScores?.pressure || 0 },
    { subject: 'Body Lang', A: latestCompleted.radarScores.bodyLanguage || 0, B: firstCompleted?.radarScores?.bodyLanguage || 0 },
    { subject: 'Professional', A: latestCompleted.radarScores.professionalism || 0, B: firstCompleted?.radarScores?.professionalism || 0 },
  ] : [];

  const handleStartMock = () => router.push("/setup");

  if (isLoading) {
    return (
      <ProtectedRoute>
        <DashboardSkeleton />
      </ProtectedRoute>
    );
  }

  if (totalSessions === 0) {
    return (
      <ProtectedRoute>
        <EmptyDashboardState onStartMock={handleStartMock} />
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute>
      <div className="space-y-12 pb-20">
        {/* Header */}
        <motion.div
          initial="hidden"
          animate="visible"
          variants={fadeUpVariant}
          className="flex items-center justify-between"
        >
          <div>
            <h1 className="text-[2.5rem] md:text-[3rem] font-serif tracking-tight text-[#111111] leading-none mb-2">
              Interve AI 控制台
            </h1>
            <p className="text-slate-500 font-medium text-[15px]">
              你的面试成长仪表盘 · {completedSessions.length} 次已完成面试
            </p>
          </div>
          <Link
            href="/setup"
            className={buttonVariants({ variant: "default", className: "rounded-full px-8 h-14 gap-3 font-semibold text-base shadow-[0_8px_24px_rgba(22,93,255,0.2)] bg-[#165DFF] hover:bg-[#4080FF] text-white transition-all active:scale-[0.98] border border-[#165DFF]/20 group" })}
          >
            <Plus weight="bold" className="w-5 h-5 group-hover:rotate-90 transition-transform duration-300" />
            New Mock Interview
          </Link>
        </motion.div>

        {/* Stats Bento Grid */}
        <motion.div
          initial="hidden"
          animate="visible"
          variants={bentoContainerVariant}
          className="grid grid-cols-1 md:grid-cols-12 gap-6"
        >
          {/* Total Sessions Card */}
          <motion.div variants={bentoCardVariant} className="md:col-span-4">
            <SpotlightCard className="p-8 h-full bg-gradient-to-br from-white/70 to-sky-50/30 group">
              <div className="flex items-center gap-4 mb-6">
                <div className="w-14 h-14 rounded-[18px] bg-sky-500 text-white flex items-center justify-center shadow-[0_8px_20px_rgba(14,165,233,0.25)] group-hover:scale-110 transition-transform duration-500">
                  <ChartLine weight="duotone" className="w-7 h-7" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-500 uppercase tracking-widest">Total Sessions</h3>
                  <p className="text-[11px] text-slate-400 font-mono uppercase tracking-widest mt-0.5">All Time</p>
                </div>
              </div>
              <div className="text-[3.5rem] font-light text-[#111111] leading-none mb-2">
                <AnimatedCounter value={totalSessions} />
              </div>
              <div className="flex items-center gap-2 text-emerald-600 text-sm font-bold">
                <TrendUp weight="bold" className="w-4 h-4" />
                <span>{completedSessions.length} completed</span>
              </div>
            </SpotlightCard>
          </motion.div>

          {/* Average Score Card */}
          <motion.div variants={bentoCardVariant} className="md:col-span-4">
            <SpotlightCard className="p-8 h-full bg-gradient-to-br from-white/70 to-emerald-50/30 group">
              <div className="flex items-center gap-4 mb-6">
                <div className="w-14 h-14 rounded-[18px] bg-emerald-500 text-white flex items-center justify-center shadow-[0_8px_20px_rgba(16,185,129,0.25)] group-hover:scale-110 transition-transform duration-500">
                  <Target weight="duotone" className="w-7 h-7" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-500 uppercase tracking-widest">Average Score</h3>
                  <p className="text-[11px] text-slate-400 font-mono uppercase tracking-widest mt-0.5">Composite</p>
                </div>
              </div>
              <div className="text-[3.5rem] font-light text-[#111111] leading-none mb-2">
                <AnimatedCounter value={avgScore} />
                <span className="text-xl text-slate-400 ml-1">/100</span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden mt-4">
                <motion.div
                  className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-sky-500"
                  initial={{ width: 0 }}
                  animate={{ width: `${avgScore}%` }}
                  transition={{ duration: 1.2, ease: "easeOut", delay: 0.3 }}
                />
              </div>
            </SpotlightCard>
          </motion.div>

          {/* Latest Session Quick Card */}
          <motion.div variants={bentoCardVariant} className="md:col-span-4">
            <SpotlightCard className="p-8 h-full bg-gradient-to-br from-white/70 to-violet-50/30 group">
              <div className="flex items-center gap-4 mb-6">
                <div className="w-14 h-14 rounded-[18px] bg-violet-500 text-white flex items-center justify-center shadow-[0_8px_20px_rgba(139,92,246,0.25)] group-hover:scale-110 transition-transform duration-500">
                  <ClockCountdown weight="duotone" className="w-7 h-7" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-500 uppercase tracking-widest">Latest Session</h3>
                  <p className="text-[11px] text-slate-400 font-mono uppercase tracking-widest mt-0.5">
                    {sessions[0]?.createdAt ? format(new Date(sessions[0].createdAt), "yyyy-MM-dd") : "N/A"}
                  </p>
                </div>
              </div>
              <h4 className="text-lg font-semibold text-[#111111] leading-snug mb-3 line-clamp-2">
                {sessions[0]?.title || "Untitled Session"}
              </h4>
              {sessions[0]?.hireVerdict && (
                <div className={`inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider ${
                  sessions[0].hireVerdict.includes('hire') && !sessions[0].hireVerdict.includes('no')
                    ? 'bg-emerald-100 text-emerald-700 border border-emerald-200'
                    : 'bg-amber-100 text-amber-700 border border-amber-200'
                }`}>
                  <Sparkle weight="fill" className="w-3 h-3" />
                  {sessions[0].hireVerdict.replace(/_/g, ' ')}
                </div>
              )}
            </SpotlightCard>
          </motion.div>
        </motion.div>

        {/* Growth Trend & Radar Charts */}
        {completedSessions.length > 0 && (
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-50px" }}
            variants={bentoContainerVariant}
            className="grid grid-cols-1 lg:grid-cols-2 gap-6"
          >
            {/* Growth Trend */}
            <motion.div variants={bentoCardVariant}>
              <SpotlightCard className="p-8 bg-gradient-to-br from-white/70 to-sky-50/20">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 rounded-[14px] bg-sky-50 border border-sky-100 flex items-center justify-center">
                    <TrendUp weight="duotone" className="w-5 h-5 text-sky-500" />
                  </div>
                  <div>
                    <h3 className="text-lg font-serif text-[#111111]">Growth Trend</h3>
                    <p className="text-xs font-mono text-slate-500 uppercase tracking-widest">Score progression</p>
                  </div>
                </div>
                {trendData.length > 1 ? (
                  <GrowthTrendChart
                    trendData={trendData}
                    onSessionClick={(sessionId) => {
                      const session = sessions.find(s => String(s.id) === sessionId);
                      if (session) setSelectedSession(session);
                    }}
                  />
                ) : (
                  <div className="h-[280px] flex items-center justify-center text-slate-400 text-sm">
                    Complete at least 2 sessions to see your growth trend
                  </div>
                )}
              </SpotlightCard>
            </motion.div>

            {/* Skill Radar */}
            <motion.div variants={bentoCardVariant}>
              <SpotlightCard className="p-8 bg-gradient-to-br from-white/70 to-violet-50/20">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 rounded-[14px] bg-violet-50 border border-violet-100 flex items-center justify-center">
                    <Target weight="duotone" className="w-5 h-5 text-violet-500" />
                  </div>
                  <div>
                    <h3 className="text-lg font-serif text-[#111111]">Skill Breakdown</h3>
                    <p className="text-xs font-mono text-slate-500 uppercase tracking-widest">Latest vs First</p>
                  </div>
                </div>
                {radarData.length > 0 ? (
                  <SkillBreakdownChart
                    radarData={radarData}
                    showFirst={completedSessions.length > 1}
                  />
                ) : (
                  <div className="h-[280px] flex items-center justify-center text-slate-400 text-sm">
                    Complete a session to see your skill breakdown
                  </div>
                )}
              </SpotlightCard>
            </motion.div>
          </motion.div>
        )}

        {/* Delivery Telemetry Trends */}
        <ContinuousLearning />

        {/* System Telemetry */}
        <SystemTelemetry />

        {/* Achievements */}
        <AchievementShowcase />

        {/* Session History */}
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-50px" }}
          variants={fadeUpVariant}
          className="pt-4"
        >
          <div className="mb-10 flex justify-between items-end">
            <div>
              <h2 className="text-[2rem] font-serif tracking-tight text-[#111111] leading-none mb-2">
                Session History
              </h2>
              <p className="text-sm font-medium text-slate-500">
                Click any session to view its full dossier
              </p>
            </div>
          </div>

          <motion.div
            className="flex flex-col gap-5"
            variants={bentoContainerVariant}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
          >
            {sessions.map((session) => (
              <motion.div
                key={session.id}
                variants={bentoCardVariant}
                onClick={() => setSelectedSession(session)}
                className="bg-white/60 hover:bg-white/90 backdrop-blur-xl border border-white/60 hover:border-white rounded-[2.5rem] p-8 shadow-[0_4px_20px_-6px_rgba(0,0,0,0.04)] hover:shadow-[0_16px_48px_-12px_rgba(0,0,0,0.1)] transition-all duration-500 ease-out cursor-pointer relative overflow-hidden group hover:-translate-y-1"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-sky-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
                <div className="flex items-center gap-8 relative z-10">
                  {/* Score Circle */}
                  <div className="shrink-0 w-20 h-20 rounded-full bg-slate-50 border-2 border-slate-100 flex flex-col items-center justify-center group-hover:border-sky-200 group-hover:bg-sky-50/50 transition-colors duration-500">
                    {session.radarScores ? (
                      <>
                        <span className="text-2xl font-bold text-[#111111] leading-none">
                          {Math.round(
                            [session.radarScores.logic, session.radarScores.expression, session.radarScores.professionalism, session.radarScores.confidence, session.radarScores.pressure, session.radarScores.bodyLanguage]
                              .filter(Boolean)
                              .reduce((a, b) => a + b, 0) /
                            [session.radarScores.logic, session.radarScores.expression, session.radarScores.professionalism, session.radarScores.confidence, session.radarScores.pressure, session.radarScores.bodyLanguage]
                              .filter(Boolean).length
                          )}
                        </span>
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Score</span>
                      </>
                    ) : (
                      <UserCircle weight="duotone" className="w-10 h-10 text-slate-300" />
                    )}
                  </div>

                  {/* Session Info */}
                  <div className="flex-1 min-w-0">
                    <h3 className="text-xl font-semibold text-[#111111] truncate group-hover:text-sky-800 transition-colors duration-300">
                      {session.title || "Untitled Session"}
                    </h3>
                    <div className="flex items-center gap-4 mt-2">
                      <span className="flex items-center gap-1.5 text-sm text-slate-500">
                        <CalendarBlank weight="regular" className="w-4 h-4" />
                        {format(new Date(session.createdAt), "yyyy-MM-dd HH:mm")}
                      </span>
                      <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider ${
                        session.status === 'completed'
                          ? 'bg-emerald-50 text-emerald-600 border border-emerald-100'
                          : session.status === 'in_progress'
                          ? 'bg-amber-50 text-amber-600 border border-amber-100'
                          : 'bg-slate-50 text-slate-500 border border-slate-100'
                      }`}>
                        {session.status.replace(/_/g, ' ')}
                      </span>
                      {session.hireVerdict && (
                        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider ${
                          session.hireVerdict.includes('hire') && !session.hireVerdict.includes('no')
                            ? 'bg-emerald-50 text-emerald-600 border border-emerald-100'
                            : 'bg-rose-50 text-rose-600 border border-rose-100'
                        }`}>
                          <Trophy weight="fill" className="w-3 h-3" />
                          {session.hireVerdict.replace(/_/g, ' ')}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Action */}
                  <div className="shrink-0">
                    <div className="w-12 h-12 rounded-full bg-slate-50 group-hover:bg-sky-500 text-slate-400 group-hover:text-white flex items-center justify-center transition-all duration-500 shadow-[0_0_0_0px_transparent] group-hover:shadow-[0_8px_20px_rgba(14,165,233,0.3)]">
                      <Play weight="fill" className="w-5 h-5" />
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </motion.div>
        </motion.div>

        {/* Session Detail Modal */}
        <AnimatePresence>
          {selectedSession && (
            <SessionDetailModal
              session={selectedSession}
              onClose={() => setSelectedSession(null)}
            />
          )}
        </AnimatePresence>
      </div>
    </ProtectedRoute>
  );
}
