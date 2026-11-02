// Phase E1: interview settlement slice (结算) extracted from the God
// component — behavior-verbatim. Guarded by the mock journey
// (signed in → setup → interview → analysis → replay → export → delete).
//
// P0-1 (B-2): a settle write that fails used to be invisible. The catch block
// fired a toast and the very next statement reloaded the page with
// window.location.href, so the toast never painted; the candidate landed on
// /dashboard/report/<id>, a page that renders "READINESS Pending (评估中)" over
// an empty row. Observed 2026-11-01 with PATCH /rest/v1/interviews forced to
// 500: zero role="alert" nodes, no retry, no statement that anything was lost.
// Now the room stays put, states it, and offers the write again — reusing the
// evaluation it already paid for, so a retry costs one UPDATE and cannot
// produce a second row.
"use client";

import { useRef, useState } from "react";
import { useRouter, type ReadonlyURLSearchParams } from "next/navigation";
import type { UIMessage } from "@ai-sdk/react";
import { toast } from "sonner";
import { db, type Interview } from "@/lib/db";
import { getMessageText } from "@/lib/message-text";
import { summarizeDelivery, avgLatencyMs } from "@/lib/audio/delivery";
import { readApiJson } from "@/lib/api/read-response";
import type { EvaluationV2 } from "@/ai/evaluation-contract";
import {
  analysisFailureNotice,
  persistenceFailureNotice,
  planSettlement,
  unsavedNotice,
  type SettlementNotice,
} from "@/lib/interview/settlement-plan";
import type { createSttSession } from "@/lib/audio/stt";

export interface SettlementRefs {
  sttSession: { current: ReturnType<typeof createSttSession> };
  answerSegments: { current: { startMs: number; endMs: number }[] };
  interruptions: { current: number };
  roundTrips: { current: number[] };
  ttftSamples: { current: number[] };
  whisperTurnarounds: { current: number[] };
  ttsStartupSamples: { current: number[] };
  mediaRecorder: { current: MediaRecorder | null };
}

export interface SettlementOptions {
  messages: UIMessage[];
  framework: string;
  interviewType?: string;
  wpm: number;
  fillerWordsCount: number;
  searchParams: ReadonlyURLSearchParams | null;
  stopAiPlayback: () => void;
  setActiveStream: (s: MediaStream | null) => void;
  refs: SettlementRefs;
}

/** The row update a settle will perform, kept so a retry writes rather than re-evaluates. */
interface PendingWrite {
  id: number;
  changes: Partial<Interview>;
}

export function useInterviewSettlement(opts: SettlementOptions) {
  const router = useRouter();
  const [isEnding, setIsEnding] = useState(false);
  // null = nothing went wrong. Non-null = the room must stay on screen.
  const [saveFailure, setSaveFailure] = useState<{ notice: SettlementNotice } | null>(null);
  const [isRetrying, setIsRetrying] = useState(false);
  const pendingWrite = useRef<PendingWrite | null>(null);

  /**
   * The one whole-document navigation this app keeps. A full reload, not a
   * client transition: leaving the room must take the microphone and both
   * speech engines down with it (docs/audit/facts.limits.json pins the count at
   * one site for exactly this reason, and tests/unit/anchor-integrity.test.ts
   * reads the destinations out of this assignment — so both routes stay spelled
   * here rather than behind a variable).
   *
   * `null` means the session had no row to report on and the dashboard is the
   * only honest destination.
   */
  const leaveRoom = (reportId: string | null) => {
    window.location.href = reportId ? `/dashboard/report/${reportId}` : "/dashboard";
  };

  /** /api/analyze-interview → the row update it implies. Nothing is written here. */
  const prepare = async (interviewId: string): Promise<"ready" | "analysis-failed"> => {
    const res = await fetch("/api/analyze-interview", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: opts.messages, framework: opts.framework, interviewType: opts.interviewType })
    });

    const result = await readApiJson<EvaluationV2>(res);

    if (!result.ok) {
      // Every non-2xx now says something. Previously only the thin-transcript
      // floor (422 / THIN_TRANSCRIPT) produced a message, so a 500, a provider
      // timeout, or a body that was never JSON (a function killed mid-stream
      // returns HTML with a 200-ish status) left the candidate walking into an
      // empty report with no explanation and no status to report.
      const notice = analysisFailureNotice({ ok: false, ...result.failure });
      if (notice) {
        toast(notice.title, { description: notice.description, duration: 8000 });
      }
      return "analysis-failed";
    }

    // Phase 4: evidence-grounded evaluation (rubric-anchored dimensions
    // + readiness). Legacy radarScores/hireVerdict are no longer produced;
    // historical rows keep rendering via the eval-compat adapter.
    const evaluationV2 = result.data;
    const { qaReview } = evaluationV2;

    // Phase 3 (Truthfulness Reset): no visual metrics are collected
    // anymore (CameraSelfView performs zero analysis), so nothing
    // vision-derived is persisted.
    // Phase 8 (19.3): observable delivery analytics only.
    // Phase 13 (31): latency breakdown averages (undefined when unmeasured).
    const stt = opts.refs.sttSession.current.stats();
    const delivery = summarizeDelivery({
      wpm: opts.wpm || 0,
      fillerWords: opts.fillerWordsCount || 0,
      answerSegments: opts.refs.answerSegments.current,
      interruptions: opts.refs.interruptions.current,
      roundTripsMs: opts.refs.roundTrips.current,
      sttAvgConfidence: stt.avgConfidence,
      sttFinals: stt.finals,
      sttReconnects: stt.reconnects,
    });

    pendingWrite.current = {
      id: parseInt(interviewId, 10),
      changes: {
        status: 'completed',
        evaluationV2,
        qaReview,
        transcript: opts.messages.map((m: UIMessage & { content?: string; parts?: unknown[]; createdAt?: Date }) => ({
          id: m.id,
          role: m.role,
          // Phase 14: persist rendered text (v6 parts-first).
          content: getMessageText(m as { parts?: unknown; content?: unknown; text?: unknown }),
          createdAt: m.createdAt || new Date()
        })),
        deliveryStats: {
          wpm: delivery.wpm,
          fillerWords: delivery.fillerWords,
          interruptions: delivery.interruptions,
          avgAnswerSec: delivery.avgAnswerSec ?? undefined,
          avgRoundTripMs: delivery.avgRoundTripMs ?? undefined,
          sttAvgConfidence: delivery.sttAvgConfidence ?? undefined,
          sttFinals: delivery.sttFinals,
          sttReconnects: delivery.sttReconnects,
          ttftMs: avgLatencyMs(opts.refs.ttftSamples.current),
          whisperMs: avgLatencyMs(opts.refs.whisperTurnarounds.current),
          ttsStartupMs: avgLatencyMs(opts.refs.ttsStartupSamples.current),
        },
        updatedAt: new Date()
      },
    };
    return "ready";
  };

  /**
   * B-2 read-back: a 2xx from PostgREST is not evidence that the row now holds
   * what was sent. Write a shell and the report renders "评估中" forever, which
   * is the same silence in a politer font. So the write is only "done" once the
   * evaluation can be read back.
   */
  const writeAndVerify = async () => {
    const pending = pendingWrite.current;
    if (!pending) {
      throw new Error("settlement: nothing prepared to write");
    }
    await db.interviews.update(pending.id, pending.changes);
    const readBack = await db.interviews.get(pending.id);
    if (!readBack || !readBack.evaluationV2) {
      throw new Error(
        `settlement: read-back found no evaluation on interview ${pending.id} — the write did not land`
      );
    }
  };

  const unlockAchievements = async (id: number) => {
    // Phase 24: Check and unlock achievements
    const updatedInterview = await db.interviews.get(id);
    if (!updatedInterview) return;
    const { checkAndUnlockAchievements } = await import("@/lib/achievements");
    const newAchievements = await checkAndUnlockAchievements(updatedInterview);
    if (newAchievements.length > 0) {
      newAchievements.forEach(ach => {
        toast.success(`🏆 Achievement Unlocked: ${ach.icon} ${ach.title}`, {
          description: ach.description,
          duration: 8000,
          position: "top-center"
        });
      });
    }
  };

  /** One attempt. Returns only when it navigated; a failure leaves state for the banner. */
  const settle = async () => {
    const interviewId = opts.searchParams?.get('id') ?? null;
    const plan = planSettlement({ hasMessages: opts.messages.length > 0, interviewId });

    if (!plan.shouldAnalyze || !interviewId) {
      if (plan.unsavedReason) {
        const notice = unsavedNotice(plan.unsavedReason);
        toast.error(notice.title, { description: notice.description, duration: 9000 });
      }
      leaveRoom(plan.destination === "report" && interviewId ? interviewId : null);
      return;
    }

    try {
      if (!pendingWrite.current) {
        const prepared = await prepare(interviewId);
        if (prepared === "analysis-failed") {
          // The transcript write never ran, so there is nothing to verify.
          // Kept as before: say it, then show the (empty) report the user asked
          // for rather than stranding them in a room after the mic is gone.
          leaveRoom(interviewId);
          return;
        }
      }
      await writeAndVerify();
      await unlockAchievements(parseInt(interviewId, 10));
      leaveRoom(interviewId);
    } catch (e) {
      console.error("Interview settlement failed — the record is not saved:", e);
      setSaveFailure({ notice: persistenceFailureNotice(e) });
      setIsEnding(false);
    }
  };

  const handleEndCall = async () => {
    if (isEnding) return;
    setIsEnding(true);
    opts.stopAiPlayback();
    opts.setActiveStream(null);

    // Stop recording if active
    if (opts.refs.mediaRecorder.current && opts.refs.mediaRecorder.current.state !== 'inactive') {
      opts.refs.mediaRecorder.current.stop();
    }

    import('canvas-confetti').then((confetti) => {
      confetti.default({
        particleCount: 150,
        spread: 80,
        origin: { y: 0.6 },
        colors: ['#6366f1', '#a855f7', '#ec4899', '#14b8a6', '#f59e0b']
      });
    });

    toast("面试结束", { description: "正在生成您的详细分析报告...", duration: 5000 });

    await settle();
  };

  /**
   * The retry the banner offers. It reuses `pendingWrite` when the evaluation
   * already arrived — one UPDATE, no second provider call, no second row — and
   * re-prepares when the failure was upstream of it.
   */
  const retrySave = async () => {
    if (isRetrying) return;
    const interviewId = opts.searchParams?.get('id') ?? null;
    if (!interviewId) return;
    setIsRetrying(true);
    try {
      if (!pendingWrite.current) {
        const prepared = await prepare(interviewId);
        if (prepared === "analysis-failed") {
          leaveRoom(interviewId);
          return;
        }
      }
      await writeAndVerify();
      await unlockAchievements(parseInt(interviewId, 10));
      leaveRoom(interviewId);
    } catch (e) {
      console.error("Interview settlement retry failed — the record is still not saved:", e);
      setSaveFailure({ notice: persistenceFailureNotice(e) });
    } finally {
      setIsRetrying(false);
    }
  };

  /**
   * Leaving with the record unsaved is allowed, but never by accident: the
   * banner names the cost. router.push, not the reload above — the mic and the
   * speech engines were torn down before settlement started, and this path is a
   * deliberate discard rather than an exit that must prove teardown.
   */
  const leaveWithoutSaving = () => {
    router.push("/dashboard");
  };

  return { isEnding, handleEndCall, saveFailure, isRetrying, retrySave, leaveWithoutSaving };
}
