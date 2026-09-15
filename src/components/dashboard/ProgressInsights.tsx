"use client";

import React, { useMemo } from "react";
import { motion } from "framer-motion";
import { TrendUp, Stack, Target, ChatTeardropText, Gauge } from "@phosphor-icons/react";
import { computeProgressInsights } from "@/lib/progress";
import type { Interview } from "@/lib/db";

// Phase 7: progress beyond averages — frequency, type performance, STAR
// completion, technical depth, conciseness, improvement velocity. All
// values computed deterministically; missing data renders as "—", never
// as invented numbers.
export function ProgressInsights({ sessions }: { sessions: Interview[] }) {
  const insights = useMemo(() => computeProgressInsights(sessions), [sessions]);
  if (insights.totalCompleted === 0) return null;

  const maxFreq = Math.max(1, ...insights.frequencyLast4Weeks);
  const cards: { label: string; display: string; sub?: string; icon: React.ReactNode }[] = [
    {
      label: "Practice frequency",
      display: `${insights.frequencyLast4Weeks[3]} / wk`,
      sub: `last 4 wks: ${insights.frequencyLast4Weeks.join(" · ")}`,
      icon: <Stack className="w-5 h-5 text-sky-500" weight="duotone" />,
    },
    {
      label: "STAR completion",
      display: insights.starCompletionRate !== null ? `${insights.starCompletionRate}` : "—",
      sub: "behavioral evidence rate",
      icon: <Target className="w-5 h-5 text-emerald-500" weight="duotone" />,
    },
    {
      label: "Technical depth",
      display: insights.technicalDepth !== null ? `${insights.technicalDepth}` : "—",
      sub: "depth-family dimensions",
      icon: <Gauge className="w-5 h-5 text-violet-500" weight="duotone" />,
    },
    {
      label: "Answer length",
      display: insights.avgAnswerWords !== null ? `${insights.avgAnswerWords} w` : "—",
      sub: "mean candidate answer",
      icon: <ChatTeardropText className="w-5 h-5 text-amber-500" weight="duotone" />,
    },
    {
      label: "Improvement velocity",
      display: insights.improvementVelocity !== null
        ? `${insights.improvementVelocity > 0 ? "+" : ""}${insights.improvementVelocity}`
        : "—",
      sub: "2nd-half vs 1st-half avg",
      icon: <TrendUp className="w-5 h-5 text-teal-500" weight="duotone" />,
    },
  ];

  return (
    <motion.div
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: "-50px" }}
      className="grid grid-cols-2 md:grid-cols-5 gap-4"
    >
      {cards.map((c) => (
        <div key={c.label} className="bg-white/60 backdrop-blur-xl border border-white/60 rounded-[20px] p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-3">{c.icon}
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">{c.label}</span>
          </div>
          <div className="text-2xl font-light text-[#111111]">{c.display}</div>
          <div className="text-[11px] text-slate-400 mt-1">{c.sub}</div>
        </div>
      ))}
      {insights.typePerformance.length > 0 && (
        <div className="col-span-2 md:col-span-5 bg-white/60 backdrop-blur-xl border border-white/60 rounded-[20px] p-5 shadow-sm">
          <div className="text-[11px] font-bold text-slate-500 uppercase tracking-widest mb-3">Performance by interview type</div>
          <div className="flex flex-wrap gap-2">
            {insights.typePerformance.map((t) => (
              <span key={t.type} className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-50 border border-slate-200 text-xs font-bold text-slate-600">
                {t.type}
                <span className="text-slate-400">×{t.count}</span>
                <span className="text-sky-600">{t.average ?? "—"}</span>
              </span>
            ))}
          </div>
          <div className="mt-3 h-1.5 flex gap-1">
            {insights.frequencyLast4Weeks.map((f, i) => (
              <div key={i} className="flex-1 bg-slate-100 rounded-full overflow-hidden">
                <div className="h-full bg-sky-400 rounded-full" style={{ width: `${Math.round((f / maxFreq) * 100)}%` }} />
              </div>
            ))}
          </div>
        </div>
      )}
    </motion.div>
  );
}
