"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

/* ─── SessionTimeline ──────────────────────────────────────────
   通用纵向时间线（TraceTimeline 的 Interve 适配）：
   面试 transcript / evaluation 事件 / 操作历史统一用它呈现。
---------------------------------------------------------------- */

export type TimelineStatus = "completed" | "current" | "upcoming" | "failed";

export interface TimelineItem {
  id: string;
  title: string;
  description?: string;
  time?: string;
  status?: TimelineStatus;
}

const DOT_STYLES: Record<TimelineStatus, string> = {
  completed: "bg-emerald-500 border-emerald-200",
  current: "bg-sky-500 border-sky-200",
  upcoming: "bg-slate-200 border-slate-100",
  failed: "bg-red-500 border-red-200",
};

export function SessionTimeline({
  items,
  className,
}: {
  items: TimelineItem[];
  className?: string;
}) {
  if (items.length === 0) return null;
  return (
    <ol className={cn("relative flex flex-col gap-6 border-l border-slate-200 pl-6", className)}>
      {items.map((item) => {
        const status = item.status ?? "completed";
        return (
          <li key={item.id} className="relative">
            <span
              aria-hidden="true"
              className={cn(
                "absolute -left-[31px] top-1 h-3 w-3 rounded-full border-2",
                DOT_STYLES[status]
              )}
            />
            <div className="flex flex-wrap items-baseline gap-x-3">
              <p className="text-sm font-semibold text-slate-900">{item.title}</p>
              {item.time && (
                <time className="font-mono text-xs text-slate-400">{item.time}</time>
              )}
            </div>
            {item.description && (
              <p className="mt-1 text-sm leading-6 text-slate-500">{item.description}</p>
            )}
          </li>
        );
      })}
    </ol>
  );
}
