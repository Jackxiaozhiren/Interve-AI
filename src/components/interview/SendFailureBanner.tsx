"use client";

import { WarningCircle } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import type { SendFailureNotice } from "@/hooks/useSendFailureRecovery";

/**
 * A send that never reached the route used to look exactly like a slow answer:
 * no alert, the composer already cleared, and only the candidate's own line in
 * the transcript. On a phone that is the ordinary shape of a dropped
 * connection, so the failure has to say what happened, keep the text where the
 * candidate can edit it, and offer the retry.
 *
 * The same banner carries a reply that arrived only halfway, with different
 * words and without restoring the answer — see `useSendFailureRecovery`.
 *
 * role="alert" rather than a toast, for the same reason the settlement banner
 * uses one: the state lasts until the retry succeeds, and a message that
 * disappears in four seconds cannot carry "your answer was not delivered".
 */
export function SendFailureBanner({
  retrying,
  onRetry,
  onDismiss,
  notice,
}: {
  retrying: boolean;
  onRetry: () => void;
  onDismiss: () => void;
  notice: SendFailureNotice;
}) {
  return (
    <div
      role="alert"
      aria-live="assertive"
      className="fixed left-1/2 top-4 z-[110] w-[min(720px,calc(100vw-2rem))] -translate-x-1/2 rounded-2xl border border-amber-200 bg-white/95 p-4 shadow-[0_16px_48px_rgba(15,23,42,0.18)] backdrop-blur-xl"
    >
      <div className="flex items-start gap-3">
        <WarningCircle weight="duotone" className="mt-0.5 h-6 w-6 shrink-0 text-amber-500" />
        <div className="min-w-0 flex-1">
          <p className="text-base font-semibold text-slate-900">{notice.title}</p>
          <p className="mt-1 text-sm leading-relaxed text-slate-600">{notice.description}</p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Button
              onClick={onRetry}
              disabled={retrying}
              className="min-h-11 rounded-full bg-amber-500 text-white shadow-sm hover:bg-amber-600 sm:min-h-0"
            >
              {retrying ? "正在重试…" : notice.retryLabel}
            </Button>
            <Button
              onClick={onDismiss}
              variant="ghost"
              className="min-h-11 rounded-full text-slate-500 sm:min-h-0"
            >
              先不管，继续
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
