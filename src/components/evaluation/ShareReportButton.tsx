"use client";

import { useState } from "react";
import { toast } from "sonner";
import { LinkSimple, Copy } from "@phosphor-icons/react";
import { supabase } from "@/lib/supabase";
import { copyTextToClipboard } from "@/lib/clipboard";
import type { EvaluationView } from "@/lib/eval-compat";
import type { Interview } from "@/lib/db";
import {
  buildSharePayload,
  generateShareToken,
  hashShareToken,
  shareExpiry,
  shareUrl,
  SHARE_MAX_VIEWS,
  SHARE_TTL_DAYS,
} from "@/lib/share";

interface ShareReportButtonProps {
  /** Numeric row id, or null for a session that was never saved. */
  interviewId: number | null;
  view: EvaluationView;
  roadmap: Interview["trainingRoadmap"] | undefined;
}

/**
 * Creates a link and shows it once.
 *
 * The link is the credential, so it exists only in this component's state and
 * on the clipboard — the database stores sha256(token), never the token. That
 * also means a link cannot be recovered later; if it is lost, make a new one,
 * which is the honest behaviour for a bearer token.
 */
export function ShareReportButton({ interviewId, view, roadmap }: ShareReportButtonProps) {
  const [url, setUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const create = async () => {
    setError(null);
    if (interviewId === null) {
      setError("这次面试没有保存到数据库，无法生成分享链接。");
      return;
    }
    setBusy(true);
    try {
      const token = generateShareToken();
      const tokenHash = await hashShareToken(token);
      const { error: insertError } = await supabase.from("report_shares").insert({
        interview_id: interviewId,
        token_hash: tokenHash,
        payload: buildSharePayload(view, roadmap),
        expires_at: shareExpiry(),
        max_views: SHARE_MAX_VIEWS,
      });
      if (insertError) {
        // 42P01 = undefined_table: migration 008 has not been applied here yet.
        setError(
          insertError.code === "42P01"
            ? "分享功能尚未启用，请稍后再试。"
            : "链接生成失败，请稍后重试。"
        );
        console.error("Failed to create report share:", insertError);
        return;
      }
      setUrl(shareUrl(window.location.origin, token));
    } catch (e) {
      setError("链接生成失败，请稍后重试。");
      console.error("Failed to create report share:", e);
    } finally {
      setBusy(false);
    }
  };

  const copy = async () => {
    if (!url) return;
    // The shared helper, not navigator.clipboard directly: it tolerates the
    // insecure-context case where the API is undefined, and returns whether the
    // write actually happened. A success toast is only allowed after that answer.
    const copied = await copyTextToClipboard(url);
    if (copied) {
      toast.success("链接已复制");
    } else {
      toast.error("无法写入剪贴板，请手动选择链接");
    }
  };

  return (
    <div className="rounded-2xl border border-slate-100 bg-white/70 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-slate-800">把这份报告发给朋友或导师</p>
          <p className="text-xs text-slate-500 mt-0.5">
            链接 {SHARE_TTL_DAYS} 天后失效，最多打开 {SHARE_MAX_VIEWS} 次；不包含逐字证据与逐题复盘。
          </p>
        </div>
        <button
          type="button"
          onClick={create}
          disabled={busy}
          className="inline-flex items-center gap-2 min-h-11 sm:min-h-0 px-4 py-2 rounded-lg border border-slate-200 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
        >
          <LinkSimple className="w-4 h-4" />
          {busy ? "生成中…" : url ? "再生成一条" : "生成分享链接"}
        </button>
      </div>

      {error && (
        <p role="alert" aria-live="assertive" className="mt-3 text-sm text-rose-600">
          {error}
        </p>
      )}

      {url && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <input
            readOnly
            value={url}
            aria-label="分享链接"
            onFocus={(e) => e.currentTarget.select()}
            className="flex-1 min-w-0 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700"
          />
          <button
            type="button"
            onClick={copy}
            className="inline-flex items-center gap-1.5 min-h-11 sm:min-h-0 px-3 py-2 rounded-lg bg-slate-900 text-white text-xs font-medium"
          >
            <Copy className="w-3.5 h-3.5" />
            复制
          </button>
        </div>
      )}
    </div>
  );
}
