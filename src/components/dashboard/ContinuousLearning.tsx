"use client";

import React, { useEffect, useState } from "react";
import { db, Interview } from "@/lib/db";
import { 
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area,
  Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Legend
} from 'recharts';
import { TrendUp, WarningCircle, CheckCircle, Target, ChartLineUp } from "@phosphor-icons/react";
import { format } from "date-fns";
import { motion } from "framer-motion";
import { Shimmer } from "@/components/ui/shimmer";
import { AnimatedCounter } from "@/components/ui/animated-counter";

export function ContinuousLearning() {
  const [sessions, setSessions] = useState<Interview[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const data = await db.interviews
          .where('status')
          .equals('completed')
          .sortBy('createdAt');
        
        // Ensure valid data points
        const validData = data.filter(s => s.deliveryStats || s.radarScores);
        setSessions(validData);
      } catch (error) {
        console.error("Failed to fetch historical data", error);
      } finally {
        setLoading(false);
      }
    };
    
    fetchHistory();
  }, []);

  if (loading) {
    return (
      <div className="w-full">
        <h4 className="text-[1.5rem] font-serif text-[#111111] mb-6 flex items-center gap-2">
          <ChartLineUp size={24} className="text-sky-500" />
          Delivery Telemetry
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="flex flex-col gap-3 p-5 bg-white/40 backdrop-blur-xl border border-white/60 rounded-3xl shadow-[0_4px_24px_-8px_rgba(0,0,0,0.05)]">
              <div className="flex items-center gap-2">
                <Shimmer className="w-8 h-8 rounded-full" />
                <Shimmer className="h-4 w-24 rounded-full" />
              </div>
              <Shimmer className="h-10 w-20 rounded-full mt-2" />
              <div className="mt-auto pt-4 border-t border-slate-100/50">
                <Shimmer className="h-3 w-32 rounded-full" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (sessions.length < 2) {
    return (
      <div className="bg-white/40 backdrop-blur-xl border border-white/60 rounded-[32px] p-8 shadow-[0_8px_32px_rgba(0,0,0,0.04)] text-center h-full flex flex-col items-center justify-center">
        <div className="w-16 h-16 rounded-full bg-slate-50 flex items-center justify-center border border-slate-100 shadow-inner mb-4">
          <Target weight="duotone" className="w-8 h-8 text-sky-400" />
        </div>
        <h3 className="text-lg font-serif tracking-tight text-[#111111] mb-2">Telemetry Insights</h3>
        <p className="text-sm text-slate-500 max-w-sm">
          Complete at least 2 full interviews to unlock your growth trend analysis, including WPM tracking, filler words reduction, and capability evolution.
        </p>
      </div>
    );
  }

  // Prepare chart data
  const trendData = sessions.map((s, index) => ({
    name: `Session ${index + 1}`,
    date: format(new Date(s.createdAt), "MM/dd"),
    wpm: s.deliveryStats?.wpm || 0,
    fillerWords: s.deliveryStats?.fillerWords || 0,
    logic: s.radarScores?.logic || 0,
    expression: s.radarScores?.expression || 0,
    confidence: s.radarScores?.confidence || 0,
  }));

  // Insights calculation
  const latest = trendData[trendData.length - 1];
  const previous = trendData[trendData.length - 2];
  
  const wpmDiff = latest.wpm - previous.wpm;
  const fillerDiff = latest.fillerWords - previous.fillerWords;
  const logicDiff = latest.logic - previous.logic;

  return (
    <div className="bg-white/40 backdrop-blur-3xl border border-white/60 rounded-[32px] p-8 shadow-[0_12px_40px_-12px_rgba(0,0,0,0.06),inset_0_1px_1px_rgba(255,255,255,0.9)] w-full relative overflow-hidden">
      {/* Decorative glows */}
      <div className="absolute top-[-20%] right-[-10%] w-[50%] h-[50%] bg-gradient-to-bl from-sky-200/40 to-transparent blur-3xl rounded-full pointer-events-none" />
      <div className="absolute bottom-[-20%] left-[-10%] w-[50%] h-[50%] bg-gradient-to-tr from-emerald-200/30 to-transparent blur-3xl rounded-full pointer-events-none" />

      <div className="flex items-center justify-between mb-8 relative z-10">
        <div>
          <h2 className="text-[2rem] font-serif tracking-tight text-[#111111] leading-none mb-2">
            Telemetry Trends
          </h2>
          <p className="text-sm font-medium text-slate-500">Aggregated analysis based on your past {sessions.length} sessions</p>
        </div>
      </div>

      <motion.div 
        className="grid grid-cols-1 lg:grid-cols-3 gap-6 relative z-10"
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: "-50px" }}
        variants={{
          hidden: { opacity: 0 },
          visible: {
            opacity: 1,
            transition: { staggerChildren: 0.15 }
          }
        }}
      >
        
        {/* WPM Trend Chart */}
        <motion.div variants={{ hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0 } }} layout className="bg-white/60 hover:bg-white/80 border border-white/80 rounded-[24px] p-6 shadow-[0_4px_24px_-8px_rgba(0,0,0,0.05)] hover:shadow-[0_8px_32px_-8px_rgba(0,0,0,0.08)] transition-all duration-500 ease-out hover:-translate-y-1 relative group overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-sky-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
          <div className="flex justify-between items-start mb-4">
            <div>
              <h3 className="text-sm font-bold text-slate-700 tracking-wide">Speaking Rate (WPM)</h3>
              <p className="text-[11px] font-mono text-slate-500 uppercase tracking-widest mt-1">Optimal: 120-150</p>
            </div>
            <div className={`px-3 py-1.5 rounded-full text-[11px] font-bold flex items-center gap-1.5 ${wpmDiff >= 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
              <TrendUp weight="bold" className={wpmDiff < 0 ? "rotate-180" : ""} />
              <AnimatedCounter value={Math.abs(wpmDiff)} /> WPM
            </div>
          </div>
          <div className="h-[180px] w-full">
            <ResponsiveContainer width="100%" height="100%" minWidth={200} minHeight={180}>
              <AreaChart data={trendData} margin={{ top: 5, right: 0, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorWpm" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#64748b' }} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#64748b' }} domain={['dataMin - 10', 'dataMax + 10']} />
                <Tooltip 
                  contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 8px 30px rgba(0,0,0,0.08)' }}
                  labelStyle={{ fontWeight: 'bold', color: '#334155' }}
                />
                <Area type="monotone" dataKey="wpm" name="WPM" stroke="#0ea5e9" strokeWidth={3} fillOpacity={1} fill="url(#colorWpm)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        {/* Filler Words Trend Chart */}
        <motion.div variants={{ hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0 } }} layout className="bg-white/60 hover:bg-white/80 border border-white/80 rounded-[24px] p-6 shadow-[0_4px_24px_-8px_rgba(0,0,0,0.05)] hover:shadow-[0_8px_32px_-8px_rgba(0,0,0,0.08)] transition-all duration-500 ease-out hover:-translate-y-1 relative group overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-rose-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
          <div className="flex justify-between items-start mb-4">
            <div>
              <h3 className="text-sm font-bold text-slate-700 tracking-wide">Filler Words Trend</h3>
              <p className="text-[11px] font-mono text-slate-500 uppercase tracking-widest mt-1">Goal: Minimize</p>
            </div>
            <div className={`px-3 py-1.5 rounded-full text-[11px] font-bold flex items-center gap-1.5 ${fillerDiff <= 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
              {fillerDiff <= 0 ? <CheckCircle weight="bold" /> : <WarningCircle weight="bold" />}
              {fillerDiff > 0 ? '+' : ''}<AnimatedCounter value={Math.abs(fillerDiff)} /> words
            </div>
          </div>
          <div className="h-[180px] w-full">
            <ResponsiveContainer width="100%" height="100%" minWidth={200} minHeight={180}>
              <AreaChart data={trendData} margin={{ top: 5, right: 0, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorFiller" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#f43f5e" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#64748b' }} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#64748b' }} />
                <Tooltip 
                  contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 8px 30px rgba(0,0,0,0.08)' }}
                  labelStyle={{ fontWeight: 'bold', color: '#334155' }}
                />
                <Area type="monotone" dataKey="fillerWords" name="Filler Words" stroke="#f43f5e" strokeWidth={3} fillOpacity={1} fill="url(#colorFiller)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        {/* Radar Capability Evolution */}
        <motion.div variants={{ hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0 } }} layout className="bg-white/60 hover:bg-white/80 border border-white/80 rounded-[24px] p-6 shadow-[0_4px_24px_-8px_rgba(0,0,0,0.05)] hover:shadow-[0_8px_32px_-8px_rgba(0,0,0,0.08)] transition-all duration-500 ease-out hover:-translate-y-1 relative group overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-violet-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
          <div className="flex justify-between items-start mb-0">
            <div>
              <h3 className="text-sm font-bold text-slate-700 tracking-wide">Core Capability</h3>
              <p className="text-[11px] font-mono text-slate-500 uppercase tracking-widest mt-1">Latest vs Previous</p>
            </div>
            {logicDiff > 0 && (
              <div className="px-3 py-1.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-700 flex items-center gap-1.5">
                <TrendUp weight="bold" />
                Logic +<AnimatedCounter value={logicDiff} />
              </div>
            )}
          </div>
          <div className="h-[200px] w-full -mt-4">
            <ResponsiveContainer width="100%" height="100%" minWidth={200} minHeight={180}>
              <RadarChart cx="50%" cy="50%" outerRadius="70%" data={[
                { subject: 'Logic', A: latest.logic, B: previous.logic, fullMark: 100 },
                { subject: 'Expression', A: latest.expression, B: previous.expression, fullMark: 100 },
                { subject: 'Confidence', A: latest.confidence, B: previous.confidence, fullMark: 100 },
              ]}>
                <PolarGrid stroke="#cbd5e1" strokeDasharray="3 3" />
                <PolarAngleAxis dataKey="subject" tick={{ fill: '#475569', fontSize: 11, fontWeight: 600, fontFamily: 'var(--font-mono)' }} />
                <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
                <Radar name="Latest" dataKey="A" stroke="#8b5cf6" strokeWidth={2} fill="#8b5cf6" fillOpacity={0.5} />
                <Radar name="Previous" dataKey="B" stroke="#94a3b8" strokeWidth={2} fill="#94a3b8" fillOpacity={0.2} strokeDasharray="3 3" />
                <Legend wrapperStyle={{ fontSize: '11px', fontWeight: 500 }} />
                <Tooltip />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </motion.div>
      </motion.div>
    </div>
  );
}

