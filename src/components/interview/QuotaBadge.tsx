"use client";

import { useSyncExternalStore } from "react";
import { getQuota, subscribeQuota } from "@/lib/api/quota";

/**
 * "what is left of today's AI allowance", in the room header.
 *
 * Renders nothing until a response has actually carried the number. That is the
 * point: an empty slot is honest, a placeholder "200" is a guess and a "0" would
 * read as an outage. The reading arrives from `interview-chat`'s response headers
 * (wrapped in the transport's fetch) and from every `readApiJson` call site.
 */
export function QuotaBadge() {
  const quota = useSyncExternalStore(subscribeQuota, getQuota, () => null);
  if (!quota) return null;

  const low = quota.remaining <= 20;
  return (
    <span
      role="status"
      aria-live="polite"
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[12px] font-medium tabular-nums ${
        low
          ? "border-amber-200 bg-amber-50 text-amber-700"
          : "border-slate-200 bg-white/70 text-slate-600"
      }`}
      title="今日 AI 调用额度（每类接口，按账号与出口 IP 共享）"
    >
      今日剩余 {quota.remaining} 次
    </span>
  );
}
