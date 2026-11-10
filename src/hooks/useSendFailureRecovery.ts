"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { UIMessage } from "ai";

export interface SendFailureNotice {
  title: string;
  description: string;
  retryLabel: string;
}

/**
 * A send that never reached the route and a reply that arrived only halfway
 * are different losses and need different sentences. The first one means the
 * interviewer heard nothing; putting the answer back in the composer is the
 * only way to let the candidate say it again. The second one means the answer
 * did arrive — restoring it would invite sending the same turn twice — while
 * the question on screen is only half of what the interviewer said.
 *
 * The same split applies to a transport `error`: an error raised after the
 * assistant has already spoken is a cut reply, not a lost send, even though
 * both arrive through the identical `error` state.
 */
const SEND_FAILED_NOTICE: SendFailureNotice = {
  title: "这条回答没有发送成功",
  description: "网络中断了，面试官没有收到。你写的内容已放回输入框，检查网络后可以重试。",
  retryLabel: "重试发送",
};

const TRUNCATED_NOTICE: SendFailureNotice = {
  title: "面试官的回答被截断了",
  description: "网络中断，这条回复只收到一半。重新生成会再问一次这一轮，不会重复发送你的回答。",
  retryLabel: "重新生成",
};

/** True when the assistant message already carries text the candidate can read. */
function hasSpokenText(message: UIMessage | undefined): boolean {
  if (!message || message.role !== "assistant") return false;
  return (message.parts ?? []).some((p) => p.type === "text" && p.text.trim().length > 0);
}

export function useSendFailureRecovery({
  error,
  truncated,
  messages,
  setInputText,
  regenerate,
}: {
  error: Error | undefined;
  /** True when the last turn's stream ended before text-end (no finish chunk). */
  truncated: boolean;
  messages: UIMessage[];
  setInputText: (value: string) => void;
  regenerate: () => Promise<void>;
}) {
  const lastSentTextRef = useRef("");
  const [dismissed, setDismissed] = useState(false);
  const [retrying, setRetrying] = useState(false);

  const failed = Boolean(error);
  // An error after the first text delta describes the reply, not the send.
  const partialReply = failed && hasSpokenText(messages[messages.length - 1]);
  const active = failed || truncated;
  const interrupted = truncated || partialReply;

  // Restoring the answer is what makes the retry their answer rather than a
  // blank turn. Keyed on the failure state so it runs once per failure, and
  // only for a send that never arrived.
  useEffect(() => {
    if (!active) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDismissed(false);
    if (failed && !partialReply && lastSentTextRef.current) setInputText(lastSentTextRef.current);
  }, [active, failed, partialReply, setInputText]);

  const remember = useCallback((text: string) => {
    lastSentTextRef.current = text;
    // A new turn is a new chance to state a failure: the previous "先不管"
    // must not suppress the next one.
    setDismissed(false);
  }, []);

  const retry = useCallback(async () => {
    setRetrying(true);
    try {
      await regenerate();
    } finally {
      setRetrying(false);
    }
  }, [regenerate]);

  return {
    visible: active && !dismissed,
    retrying,
    retry,
    dismiss: () => setDismissed(true),
    remember,
    notice: interrupted ? TRUNCATED_NOTICE : SEND_FAILED_NOTICE,
  };
}
