"use client";

import { WarningCircle } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import type { SettlementNotice } from "@/lib/interview/settlement-plan";

/**
 * P0-1: the sentence a failed save owes the candidate.
 *
 * It is a role="alert" rather than a toast on purpose. The failure it reports
 * used to be a toast followed one statement later by a page reload, so it never
 * painted; and a toast that disappears in four seconds is the wrong shape for
 * "your record is not stored". This stays until the write succeeds or the
 * candidate leaves knowing the cost.
 */
export function UnsavedSessionBanner({
  notice,
  retrying,
  onRetry,
  onLeave,
}: {
  notice: SettlementNotice;
  retrying: boolean;
  onRetry: () => void;
  onLeave: () => void;
}) {
  return (
    <div
      role="alert"
      aria-live="assertive"
      className="fixed left-1/2 top-4 z-[110] w-[min(720px,calc(100vw-2rem))] -translate-x-1/2 rounded-2xl border border-rose-200 bg-white/95 p-4 shadow-[0_16px_48px_rgba(15,23,42,0.18)] backdrop-blur-xl"
    >
      <div className="flex items-start gap-3">
        <WarningCircle weight="duotone" className="mt-0.5 h-6 w-6 shrink-0 text-rose-500" />
        <div className="min-w-0 flex-1">
          <p className="text-base font-semibold text-slate-900">{notice.title}</p>
          <p className="mt-1 text-sm leading-relaxed text-slate-600">{notice.description}</p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Button
              onClick={onRetry}
              disabled={retrying}
              size="sm"
              className="rounded-full bg-rose-500 text-white shadow-sm hover:bg-rose-600"
            >
              {retrying ? "正在重试保存…" : "重试保存"}
            </Button>
            <Button onClick={onLeave} variant="ghost" size="sm" className="rounded-full text-slate-500">
              返回控制台（这场记录不会保存）
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
