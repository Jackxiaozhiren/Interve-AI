"use client";

import { useEffect, useState } from "react";
import { THINK_TIME_SECONDS } from "@/lib/interview/think-time";

/**
 * S4 slice 4/5: the think-time countdown (Phase 28). State and its single
 * effect moved verbatim from page.tsx; `onCountdownZero` receives the room's
 * startRecording so the countdown keeps firing the same call. The exported
 * `beginThinkTime` is the only writer the room needs.
 */
export function useThinkTime(onCountdownZero: () => void) {
  const [isThinkTimeEnabled, setIsThinkTimeEnabled] = useState(false);
  const [thinkCountdown, setThinkCountdown] = useState<number | null>(null);

  // Phase 28: Think Time Countdown
  useEffect(() => {
    if (thinkCountdown === null || thinkCountdown <= 0) {
      if (thinkCountdown === 0) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setThinkCountdown(null);
        onCountdownZero();
      }
      return;
    }
    const t = setTimeout(() => setThinkCountdown((prev) => prev! - 1), 1000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [thinkCountdown]);

  const beginThinkTime = () => setThinkCountdown(THINK_TIME_SECONDS);

  return {
    isThinkTimeEnabled,
    setIsThinkTimeEnabled,
    thinkCountdown,
    setThinkCountdown,
    beginThinkTime,
  };
}
