"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Flag } from "@phosphor-icons/react";
import { db, type ReportDispute, type ReportDisputeReason } from "@/lib/db";
import {
  appendDispute,
  DISPUTE_REASONS,
  hasDisputed,
  MAX_DISPUTE_NOTE,
} from "@/lib/report-disputes";

interface DisputePanelProps {
  /** Numeric row id, or a `local-…` id for sessions that were never saved. */
  interviewId: number | string | null;
  dimensions: { id: string; name: string }[];
  existing?: ReportDispute[];
  onSaved?: (next: ReportDispute[]) => void;
}

/**
 * "The report is the candidate's to hold and dispute."
 *
 * The report states a level about a person, so the person needs a way to say
 * "I disagree" that is recorded rather than lost in a feedback form nobody
 * reads. This panel records one objection per dimension with a closed-vocabulary
 * reason; it never changes a score, and it says so — a button that silently
 * did nothing would be worse than no button.
 */
export function DisputePanel({ interviewId, dimensions, existing, onSaved }: DisputePanelProps) {
  const [openId, setOpenId] = useState<string | null>(null);
  const [reason, setReason] = useState<ReportDisputeReason>("evidence");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<ReportDispute[]>(existing ?? []);

  if (dimensions.length === 0) return null;

  const start = (id: string) => {
    setOpenId(id);
    setReason("evidence");
    setNote("");
    setError(null);
  };

  const submit = async (dimensionId: string) => {
    setError(null);
    if (interviewId === null) {
      setError("这次面试没有保存到数据库，异议无法提交。");
      return;
    }

    const result = appendDispute(saved, {
      dimensionId,
      reason,
      note: note.trim(),
      createdAt: new Date().toISOString(),
    });
    if (!result.ok) {
      setError(
        result.error === "duplicate"
          ? "这条异议已经记录过了。"
          : result.error === "limit"
            ? "这份报告的异议数量已达上限。"
            : "异议内容不完整。"
      );
      return;
    }

    setSaving(true);
    try {
      await db.interviews.update(interviewId, { reportDisputes: result.disputes });
      setSaved(result.disputes);
      onSaved?.(result.disputes);
      setOpenId(null);
      toast.success("异议已记录", {
        description: "它不会改变分数，但会进入人工校准队列。",
      });
    } catch (e) {
      // Never a success toast on a failed write: the candidate would believe
      // a person will look, and nobody would.
      setError("异议没有提交成功，请稍后重试。");
      console.error("Failed to record report dispute:", e);
    } finally {
      setSaving(false);
    }
  };

  return (
    <section
      className="bg-white/70 backdrop-blur-xl border border-white rounded-[2rem] p-8 shadow-[0_8px_30px_rgb(0,0,0,0.04)]"
      aria-labelledby="dispute-heading"
    >
      <h3
        id="dispute-heading"
        className="text-xl font-bold text-slate-800 mb-2 flex items-center gap-3"
      >
        <Flag className="w-6 h-6 text-rose-500" weight="fill" />
        对评分有异议？
      </h3>
      <p className="text-sm text-slate-600 mb-5">
        异议不会改变分数，但会记录下来交给人工校准。每个维度可以提交一次。
      </p>

      <ul className="space-y-3">
        {dimensions.map((dim) => {
          const disputed = hasDisputed(saved, dim.id);
          const isOpen = openId === dim.id;
          return (
            <li key={dim.id} className="border border-slate-100 rounded-2xl bg-white/60 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <span className="text-sm font-semibold text-slate-800">{dim.name}</span>
                {disputed ? (
                  <span className="text-xs text-emerald-700 bg-emerald-50 px-2 py-1 rounded-lg">
                    已记录异议
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => (isOpen ? setOpenId(null) : start(dim.id))}
                    className="inline-flex items-center min-h-11 sm:min-h-0 px-3 py-1.5 rounded-lg border border-slate-200 text-sm text-slate-700 hover:bg-slate-50"
                  >
                    我有异议
                  </button>
                )}
              </div>

              {isOpen && (
                <div className="mt-4 space-y-4">
                  <fieldset>
                    <legend className="text-sm font-medium text-slate-700 mb-2">原因</legend>
                    <div className="space-y-1">
                      {DISPUTE_REASONS.map((r) => (
                        <label
                          key={r.value}
                          className="flex items-center gap-2 min-h-11 sm:min-h-0 text-sm text-slate-600"
                        >
                          <input
                            type="radio"
                            name={`dispute-reason-${dim.id}`}
                            value={r.value}
                            checked={reason === r.value}
                            onChange={() => setReason(r.value)}
                          />
                          <span>{r.label}</span>
                        </label>
                      ))}
                    </div>
                  </fieldset>

                  <label className="block">
                    <span className="text-sm font-medium text-slate-700">
                      补充说明（可选，最多 {MAX_DISPUTE_NOTE} 字）
                    </span>
                    <textarea
                      value={note}
                      onChange={(e) => setNote(e.target.value.slice(0, MAX_DISPUTE_NOTE))}
                      maxLength={MAX_DISPUTE_NOTE}
                      rows={3}
                      className="mt-2 w-full rounded-xl border border-slate-200 bg-white p-3 text-sm text-slate-700"
                    />
                  </label>

                  {error && (
                    <p role="alert" aria-live="assertive" className="text-sm text-rose-600">
                      {error}
                    </p>
                  )}

                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => submit(dim.id)}
                      disabled={saving}
                      className="inline-flex items-center min-h-11 sm:min-h-0 px-4 py-2 rounded-lg bg-slate-900 text-white text-sm font-medium disabled:opacity-60"
                    >
                      {saving ? "提交中…" : "提交异议"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setOpenId(null)}
                      className="inline-flex items-center min-h-11 sm:min-h-0 px-4 py-2 rounded-lg border border-slate-200 text-sm text-slate-700"
                    >
                      取消
                    </button>
                  </div>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
