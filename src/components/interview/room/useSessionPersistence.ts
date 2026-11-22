"use client";

import { useEffect } from "react";
import { toast } from "sonner";
import { saveSession, loadSession, clearSession } from "@/lib/interview/session-persistence";
import { toUiMessages } from "@/lib/message-text";
import type { UIMessage } from "ai";

/**
 * S4 slice 6: session persistence (Phase 26 + Phase 10). Both effects moved
 * verbatim from page.tsx — the autosave interval and the restore prompt. The
 * delivery ledger seeds the restored filler count exactly as before.
 */
export function useSessionPersistence(opts: {
  searchParams: URLSearchParams | null;
  messages: UIMessage[];
  wpm: number;
  fillerWordsCount: number;
  setMessages: (m: UIMessage[]) => void;
  setWpm: (n: number) => void;
  setFillerWordsCount: (n: number) => void;
  deliveryLedgerRef: React.RefObject<{ seed: (n: number) => number }>;
}) {
  const { searchParams, messages, wpm, fillerWordsCount, setMessages, setWpm, setFillerWordsCount, deliveryLedgerRef } = opts;

  // Phase 26: Session Persistence (+ Phase 10: 30-day local retention)
  // E1: storage mechanics live in session-persistence.ts (unit-tested);
  // the component keeps only the restore-prompt UI.
  useEffect(() => {
    const interviewId = searchParams?.get('id');
    if (!interviewId || messages.length === 0) return;
    saveSession(localStorage, interviewId, { messages, wpm, fillerWordsCount });
  }, [messages, wpm, fillerWordsCount, searchParams]);

  useEffect(() => {
    const interviewId = searchParams?.get('id');
    if (!interviewId) return;
    const loaded = loadSession(localStorage, interviewId);
    if (loaded.status !== "found") return;
    const snapshot = loaded.snapshot;
    toast("发现未完成的面试记录", {
      description: "是否恢复之前的对话和状态？",
      action: {
        label: "恢复",
        onClick: () => {
          setMessages(toUiMessages(snapshot.messages));
          if (snapshot.wpm) setWpm(snapshot.wpm);
          if (snapshot.fillerWordsCount) setFillerWordsCount(deliveryLedgerRef.current.seed(snapshot.fillerWordsCount));
          toast.success("已恢复对话记录");
        }
      },
      cancel: {
        label: "清除",
        onClick: () => {
          clearSession(localStorage, interviewId);
        }
      },
      duration: 15000,
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
