"use client";

import { WarningCircle } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";

/**
 * The confirmation a silent local-only downgrade owes the candidate.
 *
 * Measured at 390px on 2026-11-08 with POST /rest/v1/interviews forced to 500:
 * the wizard pushed straight into /interview and the only explanation was a
 * Sonner toast reading "本地模式 / 未连接数据库，本次面试仅保存在当前浏览器".
 * At +1.5s it was on screen; at +7.5s the toaster was empty and the room's
 * only role="alert" was the microphone warning. A four-second toast is the
 * wrong shape for "your report will not exist". This stays until the candidate
 * retries the write or explicitly accepts a practice-only session.
 */
export function LocalOnlyBanner({
  reason,
  onRetry,
  onContinue,
}: Readonly<{
  reason: string;
  onRetry: () => void;
  onContinue: () => void;
}>) {
  return (
    <div
      role="alert"
      aria-live="assertive"
      className="fixed left-1/2 top-4 z-[110] w-[min(720px,calc(100vw-2rem))] -translate-x-1/2 rounded-2xl border border-amber-200 bg-white/95 p-4 shadow-[0_16px_48px_rgba(15,23,42,0.18)] backdrop-blur-xl"
    >
      <div className="flex items-start gap-3">
        <WarningCircle weight="duotone" className="mt-0.5 h-6 w-6 shrink-0 text-amber-500" />
        <div className="min-w-0 flex-1">
          <p className="text-base font-semibold text-slate-900">本次面试无法保存</p>
          <p className="mt-1 text-sm leading-relaxed text-slate-600">{reason}</p>
          <p className="mt-1 text-sm leading-relaxed text-slate-600">
            面试仍可照常进行，但结束后不会生成可回看的报告、回放或历史记录。
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Button
              onClick={onRetry}
              size="sm"
              className="min-h-11 rounded-full bg-slate-800 text-white hover:bg-slate-700 sm:min-h-0"
            >
              重试连接
            </Button>
            <Button
              onClick={onContinue}
              variant="ghost"
              size="sm"
              className="min-h-11 rounded-full text-slate-500 sm:min-h-0"
            >
              仍要继续（不保存）
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
