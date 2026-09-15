"use client";

import React from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { CheckCircle, SealWarning, Quotes, Target } from "@phosphor-icons/react";
import { READINESS_META, READINESS_DISCLAIMER, type ReadinessLevel } from "@/ai/evaluation-contract";
import { drillsForWeaknesses } from "@/ai/drills/bank";
import type { DimensionView, EvaluationView } from "@/lib/eval-compat";

const READINESS_STYLES: Record<ReadinessLevel, string> = {
  needs_foundation: "bg-amber-500/10 text-amber-700 border-amber-200",
  developing: "bg-sky-500/10 text-sky-700 border-sky-200",
  interview_ready: "bg-emerald-500/10 text-emerald-700 border-emerald-200",
  strongly_prepared: "bg-emerald-600/10 text-emerald-800 border-emerald-300",
};

const CONFIDENCE_STYLES: Record<string, string> = {
  high: "bg-emerald-100/70 text-emerald-700",
  medium: "bg-amber-100/70 text-amber-700",
  low: "bg-slate-100 text-slate-500",
};

/** Readiness (V2) or legacy verdict (badged) header. Never renders a hire decision for V2 rows. */
export function ReadinessBadge({ view }: { view: EvaluationView }) {
  if (view.kind === "none") {
    return (
      <div className="px-6 py-3 rounded-2xl border bg-slate-100 text-slate-600 border-slate-200">
        <p className="text-xs font-bold uppercase tracking-wider opacity-80">Readiness</p>
        <p className="text-lg font-bold">Pending (评估中)</p>
      </div>
    );
  }
  if (view.legacy) {
    return (
      <div className="px-6 py-3 rounded-2xl border bg-slate-100 text-slate-600 border-slate-200">
        <p className="text-xs font-bold uppercase tracking-wider opacity-80 flex items-center gap-1">
          <SealWarning className="w-3.5 h-3.5" /> Legacy assessment
        </p>
        <p className="text-lg font-bold">{view.readinessLabel ?? "Legacy"}</p>
      </div>
    );
  }
  const meta = READINESS_META[(view.readinessLabel as ReadinessLevel) ?? "developing"];
  return (
    <div className={`px-6 py-3 rounded-2xl border backdrop-blur-md shadow-sm ${READINESS_STYLES[(view.readinessLabel as ReadinessLevel) ?? "developing"]}`}>
      <p className="text-xs font-bold uppercase tracking-wider opacity-80">Interview Readiness</p>
      <p className="text-lg font-bold">{meta.label} ({meta.labelZh})</p>
    </div>
  );
}

export function ReadinessDisclaimer() {
  return (
    <p className="text-xs text-slate-400 leading-relaxed mt-2 flex items-start gap-1.5">
      <CheckCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" aria-hidden="true" />
      {READINESS_DISCLAIMER}
    </p>
  );
}

export function LegacyBanner({ text }: { text?: string | null }) {
  return (
    <div className="flex items-start gap-2 px-4 py-3 rounded-2xl bg-slate-100/80 border border-slate-200 text-slate-600 text-xs leading-relaxed">
      <SealWarning className="w-4 h-4 mt-0.5 shrink-0" aria-hidden="true" />
      <span>{text ?? "Legacy assessment (pre-rubric): scores were generated without anchored criteria or captured evidence."}</span>
    </div>
  );
}

function ConfidenceChip({ level }: { level: DimensionView["confidence"] }) {
  return (
    <span className={`text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-md ${CONFIDENCE_STYLES[level]}`}>
      {level} confidence
    </span>
  );
}

/** Dimension cards with anchors, evidence quotes, rationale, and drills. Works for V2 + legacy (legacy shows no-evidence notes). */
export function DimensionsSection({ view }: { view: EvaluationView }) {
  if (view.dimensions.length === 0) return null;
  return (
    <div className="space-y-4">
      {view.dimensions.map((dim) => (
        <motion.div
          key={dim.id}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-5 border border-slate-100 rounded-2xl bg-white/60"
        >
          <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
            <div className="flex items-center gap-2">
              <span className="font-bold text-slate-800">{dim.name}</span>
              {dim.anchorLevel !== null && (
                <span className="text-[10px] font-mono font-bold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                  L{dim.anchorLevel}/5
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <ConfidenceChip level={dim.confidence} />
              <span className="text-sm font-black text-indigo-600">{dim.score100}<span className="text-[10px] text-slate-400 font-bold">/100</span></span>
            </div>
          </div>
          <div className="w-full h-1.5 bg-slate-100 rounded-full mb-3 overflow-hidden">
            <div className="h-full bg-indigo-400 rounded-full" style={{ width: `${dim.score100}%` }} />
          </div>
          <p className="text-sm text-slate-700 leading-relaxed mb-3">{dim.rationale}</p>
          {dim.evidence.length > 0 && (
            <div className="space-y-2 mb-3">
              {dim.evidence.map((q, i) => (
                <p key={i} className="text-[13px] text-slate-600 italic border-l-2 border-indigo-200 pl-3 flex gap-1.5">
                  <Quotes className="w-3.5 h-3.5 mt-0.5 shrink-0 text-indigo-300" aria-hidden="true" />
                  {q}
                </p>
              ))}
            </div>
          )}
          <p className="text-[13px] text-emerald-800 bg-emerald-50/70 rounded-xl px-3 py-2">
            <span className="font-bold">Next drill: </span>{dim.improvement}
          </p>
        </motion.div>
      ))}
    </div>
  );
}

export function StrengthsDrills({ view }: { view: EvaluationView }) {
  if (view.strengths.length === 0 && view.weaknesses.length === 0 && view.nextDrills.length === 0) return null;
  const blocks: { title: string; items: string[]; dot: string }[] = [
    { title: "Top strengths", items: view.strengths, dot: "bg-emerald-500" },
    { title: "Top gaps", items: view.weaknesses, dot: "bg-amber-500" },
    { title: "Next drills", items: view.nextDrills, dot: "bg-indigo-500" },
  ];
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      {blocks.filter((b) => b.items.length > 0).map((b) => (
        <div key={b.title} className="bg-white/50 rounded-2xl p-6 border border-white/60">
          <h4 className="font-semibold text-slate-800 mb-4">{b.title}</h4>
          <ul className="space-y-3">
            {b.items.map((item, i) => (
              <li key={i} className="text-sm text-slate-600 flex items-start gap-2">
                <div className={`w-1.5 h-1.5 rounded-full ${b.dot} mt-1.5 flex-shrink-0`} />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

/**
 * Phase 7 drill plan: curated bank tasks for the weakest dimensions
 * (Practice → Evaluate → Diagnose → Drill → Retry). Rendered on the
 * report; each drill links into the practice hub.
 */
export function DrillPlan({ view }: { view: EvaluationView }) {
  const drills = drillsForWeaknesses(
    view.dimensions.map((d) => ({
      id: d.id,
      rubricId: view.rubricId ?? "general-v1",
      score: d.anchorLevel ?? Math.round(d.score100 / 20),
    })),
    3
  );
  if (drills.length === 0) return null;
  return (
    <div className="bg-white/70 backdrop-blur-xl border border-white rounded-[2rem] p-8 shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Target className="w-5 h-5 text-indigo-500" weight="fill" />
        <h3 className="font-bold text-slate-800">Your drill plan (weakest first)</h3>
      </div>
      {drills.map((drill) => (
        <div key={drill.id} className="p-5 border border-slate-100 rounded-2xl bg-white/60">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
            <span className="font-bold text-slate-800">{drill.title} <span className="font-medium text-slate-400">· {drill.titleZh}</span></span>
            <Link
              href={`/practice?q=${encodeURIComponent(drill.title)}`}
              className="text-xs font-bold text-indigo-600 hover:text-indigo-500 hover:underline"
            >
              Practice now →
            </Link>
          </div>
          <p className="text-sm text-slate-700 leading-relaxed mb-2">{drill.task}</p>
          <p className="text-[13px] text-slate-500 italic">Tip: {drill.tip}</p>
        </div>
      ))}
    </div>
    </div>
  );
}
