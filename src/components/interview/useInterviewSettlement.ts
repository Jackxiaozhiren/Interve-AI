// Phase E1: interview settlement slice (结算) extracted from the God
// component — behavior-verbatim. Guarded by the mock journey
// (signup → setup → interview → analysis → replay → export → delete).
"use client";

import { useState } from "react";
import type { UIMessage } from "@ai-sdk/react";
import type { ReadonlyURLSearchParams } from "next/navigation";
import { toast } from "sonner";
import { db } from "@/lib/db";
import { getMessageText } from "@/lib/message-text";
import { summarizeDelivery, avgLatencyMs } from "@/lib/audio/delivery";
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

export function useInterviewSettlement(opts: SettlementOptions) {
  const [isEnding, setIsEnding] = useState(false);

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

    try {
      const interviewId = opts.searchParams?.get('id');

      if (opts.messages.length > 0 && interviewId) {
        // Fetch analysis
        const res = await fetch("/api/analyze-interview", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messages: opts.messages, framework: opts.framework, interviewType: opts.interviewType })
        });

        if (res.ok) {
          // Phase 4: evidence-grounded evaluation (rubric-anchored dimensions
          // + readiness). Legacy radarScores/hireVerdict are no longer
          // produced; historical rows keep rendering via the eval-compat
          // adapter. See EVALUATION_V2_REPORT.
          const evaluationV2 = await res.json();
          const { qaReview } = evaluationV2 as { qaReview?: { question: string; userAnswer: string; flaws: string; perfectRewrite: string }[] };

          // Phase 3 (Truthfulness Reset): no visual metrics are collected
          // anymore (CameraSelfView performs zero analysis), so nothing
          // vision-derived is persisted.
          const id = parseInt(interviewId, 10);
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
          await db.interviews.update(id, {
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
          });

          // Phase 24: Check and unlock achievements
          const updatedInterview = await db.interviews.get(id);
          if (updatedInterview) {
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
          }
        } else {
          // Thin-transcript floor (THIN_TRANSCRIPT 422): the model found
          // nothing quotable in ANY dimension. Tell the candidate to add
          // specifics and retry instead of landing on an empty report.
          let thin = res.status === 422;
          try {
            const errBody = await res.json() as { error?: { code?: string } };
            if (errBody?.error?.code === "THIN_TRANSCRIPT") thin = true;
          } catch { /* non-JSON error — fall through to generic handling */ }
          if (thin) {
            toast("回答内容较薄，暂无法生成完整评估", { description: "补充具体做法、数字和结果后重试——最弱的一次也不该只看到报错", duration: 8000 });
          }
        }
      }
    } catch (e) {
      console.error("Error analyzing interview:", e);
      toast.error("生成报告时出错", { description: "我们将保留部分数据" });
    }

    window.location.href = opts.searchParams?.get('id') ? `/dashboard/report/${opts.searchParams.get('id')}` : "/dashboard";
  };

  return { isEnding, handleEndCall };
}
