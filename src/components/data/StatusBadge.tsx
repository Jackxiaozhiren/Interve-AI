"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

/* ─── StatusBadge ──────────────────────────────────────────────
   全站统一状态徽章。语义色只用 emerald（成功）/ amber（进行中/
   警告）/ red（失败）/ slate（中性），单页强调色 ≤2 种。
   来源：shadcn/ui Badge。
   https://ui.shadcn.com/docs/components/base/badge
---------------------------------------------------------------- */

export type StatusTone = "success" | "warning" | "danger" | "info" | "neutral";

const TONE_STYLES: Record<StatusTone, string> = {
  success: "bg-emerald-50 text-emerald-700 border-emerald-200",
  warning: "bg-amber-50 text-amber-700 border-amber-200",
  danger: "bg-red-50 text-red-600 border-red-200",
  info: "bg-sky-50 text-sky-700 border-sky-100",
  neutral: "bg-slate-100 text-slate-600 border-slate-200",
};

/** 原始状态字符串 → 语义 tone，覆盖面试/候选人/通用三类状态。 */
export function statusToneOf(status: string | null | undefined): StatusTone {
  const s = (status ?? "").toLowerCase().replace(/[\s-]+/g, "_");
  if (["completed", "complete", "ok", "success", "hired", "passed", "pass", "ready", "interview_ready", "strongly_prepared"].includes(s))
    return "success";
  if (["failed", "fail", "error", "rejected"].includes(s)) return "danger";
  if (["running", "in_progress", "active", "pending", "developing", "processing"].includes(s))
    return "warning";
  if (["screening", "technical", "onsite", "offer", "draft"].includes(s)) return "info";
  return "neutral";
}

/** 原始状态字符串 → 展示文案（下划线转空格）。 */
export function statusLabelOf(status: string | null | undefined, fallback = "Unknown"): string {
  if (!status) return fallback;
  return status.replace(/_/g, " ");
}

export interface StatusBadgeProps {
  status: string | null | undefined;
  /** 强制指定 tone（默认按 statusToneOf 推断） */
  tone?: StatusTone;
  label?: string;
  dot?: boolean;
  className?: string;
}

export function StatusBadge({ status, tone, label, dot = true, className }: StatusBadgeProps) {
  const resolvedTone = tone ?? statusToneOf(status);
  const text = label ?? statusLabelOf(status);
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-bold uppercase tracking-wider",
        TONE_STYLES[resolvedTone],
        className
      )}
    >
      {dot && (
        <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-current" />
      )}
      {text}
    </span>
  );
}
