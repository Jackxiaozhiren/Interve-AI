"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

/* ─── StatCard ─────────────────────────────────────────────────
   全站统一统计卡：icon + label + value + hint。
   来源：shadcn/ui Card + next-shadcn-dashboard Stat grid。
   https://ui.shadcn.com/docs/components/base/card
   https://github.com/shadcndashboard/next-shadcn-dashboard
---------------------------------------------------------------- */

export interface StatCardProps {
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  icon?: React.ReactNode;
  /** 0-100 进度条（可选，如通过率/覆盖率） */
  progress?: number;
  className?: string;
}

export function StatCard({ label, value, hint, icon, progress, className }: StatCardProps) {
  return (
    <div
      className={cn(
        "rounded-xl border border-slate-200/70 bg-white p-6 shadow-sm",
        className
      )}
    >
      <div className="flex items-center gap-3">
        {icon && (
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
            {icon}
          </span>
        )}
        {/* F5: label slate-500 (4.8:1 on white) — slate-400 eyebrow failed axe color-contrast. */}
        <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">{label}</p>
      </div>
      <p className="mt-4 text-3xl font-semibold tracking-tight text-slate-900">{value}</p>
      {typeof progress === "number" && (
        <div
          className="mt-4 h-1.5 w-full overflow-hidden rounded-full bg-slate-100"
          role="progressbar"
          aria-valuenow={Math.round(progress)}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`${label}进度`}
        >
          <div
            className="h-full rounded-full bg-emerald-500 transition-all"
            style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
          />
        </div>
      )}
      {hint && <p className="mt-3 text-sm leading-6 text-slate-500">{hint}</p>}
    </div>
  );
}
