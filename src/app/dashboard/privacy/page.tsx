"use client";

import React, { useEffect, useState } from "react";
import { ShieldCheck, DownloadSimple, Trash, WarningCircle } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { db, type Interview } from "@/lib/db";
import { downloadFile } from "@/lib/utils/export";
import { toast } from "sonner";

// Phase 10: Privacy Center — what we collect, what we store, why, how
// long, plus WORKING delete and export. Every control below performs a
// real operation; failures surface as toasts, never silent no-ops.

const INVENTORY: { data: string; where: string; why: string; retention: string }[] = [
  { data: "Resume text", where: "Database (interviews.resume_text) when you paste/upload", why: "Ground interview questions and gap analysis in your background", retention: "Until you delete the session" },
  { data: "Job description", where: "Database (interviews.job_description)", why: "Match questions and evaluation to the target role", retention: "Until you delete the session" },
  { data: "Interview transcript", where: "Database (interviews.transcript)", why: "Generate your report, replay, and progress tracking", retention: "Until you delete the session" },
  { data: "Delivery metrics (WPM, fillers, durations)", where: "Database (interviews.delivery_stats)", why: "Observable speaking feedback on your report", retention: "Until you delete the session" },
  { data: "Evaluation + evidence quotes", where: "Database (interviews.evaluation_v2)", why: "Rubric scores with cited evidence for your review", retention: "Until you delete the session" },
  { data: "Practice answers + scores", where: "Database (practice_sessions)", why: "Retry-and-compare practice loop", retention: "Until you delete the session" },
  { data: "Raw microphone audio", where: "Nowhere permanent — transcribed in-memory, then discarded", why: "Speech-to-text needs audio; storage does not", retention: "Not stored (default)" },
  { data: "Camera video / frames", where: "This device only (self-view preview)", why: "Self-view while speaking; never analyzed, never uploaded", retention: "Never stored (default)" },
  { data: "Browser session snapshot", where: "This browser (localStorage interve_session_*)", why: "Recover an interrupted interview after reload", retention: "Auto-expires after 30 days" },
];

// Local keys owned by the app that "clear local data" removes.
// Auth session (interveai_user) and language (interve-lang) are kept.
const LOCAL_DATA_PREFIXES = ["interve_session_", "interve_scratchpad_", "interve_system_design_"];
const LOCAL_DATA_EXACT = ["interve_has_seen_onboarding"];

export default function PrivacyPage() {
  const [sessions, setSessions] = useState<Interview[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [confirmAll, setConfirmAll] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<number | string | null>(null);

  const reload = async () => {
    try {
      const rows = await db.interviews.orderBy("createdAt").reverse().toArray();
      setSessions(rows as Interview[]);
    } catch {
      toast.error("加载失败", { description: "无法读取会话列表（数据库未连接时仅本地数据可用）。" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Mount-only subscription: setState lives in promise callbacks, never
    // in the effect body (rules-of-hooks). Manual refreshes use reload().
    let cancelled = false;
    db.interviews
      .orderBy("createdAt")
      .reverse()
      .toArray()
      .then((rows) => {
        if (!cancelled) setSessions(rows as Interview[]);
      })
      .catch(() => {
        if (!cancelled) {
          toast.error("加载失败", { description: "无法读取会话列表（数据库未连接时仅本地数据可用）。" });
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const deleteSession = async (id: number | string) => {
    setBusy(`del-${id}`);
    try {
      await db.interviews.remove(id);
      setSessions((prev) => prev.filter((s) => s.id !== id));
      try {
        localStorage.removeItem(`interve_session_${id}`);
      } catch { /* best effort */ }
      toast.success("已删除", { description: "该面试会话及其云端数据已删除。" });
    } catch {
      toast.error("删除失败", { description: "请检查网络后重试。" });
    } finally {
      setBusy(null);
      setPendingDelete(null);
    }
  };

  const exportAll = async () => {
    setBusy("export");
    try {
      const [interviews, practice] = await Promise.all([
        db.interviews.orderBy("createdAt").reverse().toArray(),
        db.practiceSessions.toArray().catch(() => []),
      ]);
      downloadFile(
        JSON.stringify({ exportedAt: new Date().toISOString(), interviews, practiceSessions: practice }, null, 2),
        `interve-ai-export-${new Date().toISOString().slice(0, 10)}.json`,
        "application/json"
      );
      toast.success("已导出", { description: "你的面试与练习数据已下载为 JSON。" });
    } catch {
      toast.error("导出失败", { description: "请检查网络后重试。" });
    } finally {
      setBusy(null);
    }
  };

  const deleteAll = async () => {
    if (!confirmAll) return;
    setBusy("all");
    const failures: (number | string)[] = [];
    for (const s of sessions) {
      if (s.id === undefined) continue;
      try {
        await db.interviews.remove(s.id);
      } catch {
        failures.push(s.id);
      }
    }
    try {
      const practice = await db.practiceSessions.toArray().catch(() => []);
      for (const p of practice as { id?: number | string }[]) {
        if (p.id === undefined) continue;
        try {
          await db.practiceSessions.remove(p.id);
        } catch {
          failures.push(`practice:${p.id}`);
        }
      }
    } catch { /* practice export/delete is best-effort offline */ }
    await reload();
    setConfirmAll(false);
    setBusy(null);
    if (failures.length === 0) {
      toast.success("已全部删除", { description: "云端面试与练习数据已清空。" });
    } else {
      toast.error("部分删除失败", { description: `${failures.length} 项未能删除，请重试。` });
    }
  };

  const clearLocal = () => {
    let removed = 0;
    try {
      const keys: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k) keys.push(k);
      }
      for (const k of keys) {
        if (LOCAL_DATA_PREFIXES.some((p) => k.startsWith(p)) || LOCAL_DATA_EXACT.includes(k)) {
          localStorage.removeItem(k);
          removed += 1;
        }
      }
    } catch {
      toast.error("清理失败", { description: "浏览器拒绝访问本地存储。" });
      return;
    }
    toast.success("本地数据已清理", { description: `移除了 ${removed} 项（登录状态与语言偏好保留）。` });
  };

  return (
    <div className="space-y-10 pb-20 max-w-4xl">
      <div>
        <h1 className="text-[2.5rem] font-serif tracking-tight text-[#111111] leading-none mb-2 flex items-center gap-3">
          <ShieldCheck className="w-9 h-9 text-emerald-600" weight="duotone" />
          Privacy Center
        </h1>
        <p className="text-slate-500 font-medium">你的数据、你的控制权。以下每一项都可查看、导出或删除。</p>
      </div>

      {/* Inventory */}
      <section className="bg-white/60 backdrop-blur-xl border border-white/60 rounded-[24px] p-8 shadow-sm">
        <h2 className="text-lg font-bold text-slate-800 mb-1">收集与存储清单</h2>
        <p className="text-sm text-slate-500 mb-6">采集什么、存在哪里、为什么、保留多久。</p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-widest text-slate-400 border-b border-slate-100">
                <th className="py-2 pr-4 font-bold">数据</th>
                <th className="py-2 pr-4 font-bold">存储位置</th>
                <th className="py-2 pr-4 font-bold">用途</th>
                <th className="py-2 font-bold">保留</th>
              </tr>
            </thead>
            <tbody>
              {INVENTORY.map((row) => (
                <tr key={row.data} className="border-b border-slate-50 last:border-0">
                  <td className="py-3 pr-4 font-semibold text-slate-800">{row.data}</td>
                  <td className="py-3 pr-4 text-slate-600">{row.where}</td>
                  <td className="py-3 pr-4 text-slate-600">{row.why}</td>
                  <td className="py-3 text-slate-600">{row.retention}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Sessions */}
      <section className="bg-white/60 backdrop-blur-xl border border-white/60 rounded-[24px] p-8 shadow-sm">
        <h2 className="text-lg font-bold text-slate-800 mb-1">你的面试会话</h2>
        <p className="text-sm text-slate-500 mb-6">逐条删除（含云端记录与本地快照）。</p>
        {loading ? (
          <p className="text-sm text-slate-400">加载中…</p>
        ) : sessions.length === 0 ? (
          <p className="text-sm text-slate-400">暂无云端会话。本地快照可在下方清理。</p>
        ) : (
          <ul className="space-y-3">
            {sessions.map((s) => (
              <li key={s.id} className="flex items-center gap-4 p-4 rounded-2xl border border-slate-100 bg-white/70">
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-slate-800 truncate">{s.title || "Untitled Session"}</p>
                  <p className="text-xs text-slate-400">
                    {s.createdAt ? new Date(s.createdAt).toLocaleString() : ""} · {s.status.replace(/_/g, " ")}
                  </p>
                </div>
                {pendingDelete === s.id ? (
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="rounded-full"
                      onClick={() => setPendingDelete(null)}
                      disabled={busy !== null}
                    >
                      取消
                    </Button>
                    <Button
                      size="sm"
                      className="rounded-full bg-rose-600 hover:bg-rose-500 text-white"
                      onClick={() => s.id !== undefined && deleteSession(s.id)}
                      disabled={busy !== null}
                    >
                      {busy === `del-${s.id}` ? "删除中…" : "确认删除"}
                    </Button>
                  </div>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    className="rounded-full text-rose-600 hover:text-rose-500"
                    onClick={() => setPendingDelete(s.id ?? null)}
                    disabled={busy !== null}
                    aria-label={`删除会话 ${s.title || s.id}`}
                  >
                    <Trash className="w-4 h-4 mr-1" /> 删除
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Export + Danger zone */}
      <section className="bg-white/60 backdrop-blur-xl border border-white/60 rounded-[24px] p-8 shadow-sm">
        <h2 className="text-lg font-bold text-slate-800 mb-1">导出与彻底删除</h2>
        <p className="text-sm text-slate-500 mb-6">导出为 JSON（面试 + 练习），或清空云端全部数据。导出的文件含完整简历与逐字稿，请妥善保存在个人设备并注意转发风险。</p>
        <div className="flex flex-wrap gap-3 mb-8">
          <Button onClick={exportAll} disabled={busy !== null} className="rounded-full gap-2">
            <DownloadSimple className="w-4 h-4" />
            {busy === "export" ? "导出中…" : "导出我的全部数据"}
          </Button>
          <Button onClick={clearLocal} variant="outline" className="rounded-full">
            清理本机快照与草稿
          </Button>
        </div>
        <div className="rounded-2xl border border-rose-200 bg-rose-50/50 p-5">
          <h3 className="text-sm font-bold text-rose-700 mb-2 flex items-center gap-2">
            <WarningCircle className="w-4 h-4" weight="fill" /> 危险区：删除云端全部数据
          </h3>
          <label className="flex items-start gap-2 text-sm text-slate-600 mb-4 cursor-pointer">
            <input
              type="checkbox"
              checked={confirmAll}
              onChange={(e) => setConfirmAll(e.target.checked)}
              className="mt-1 w-4 h-4 accent-rose-600"
            />
            我理解此操作将永久删除所有云端面试与练习记录，无法恢复。
          </label>
          <Button
            onClick={deleteAll}
            disabled={!confirmAll || busy !== null}
            className="rounded-full bg-rose-600 hover:bg-rose-500 text-white disabled:opacity-40"
          >
            {busy === "all" ? "删除中…" : "永久删除全部云端数据"}
          </Button>
        </div>
      </section>
    </div>
  );
}
