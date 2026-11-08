"use client";

/**
 * The way out of a room you have not started.
 *
 * Both gates before the interview — the device check and the standby card —
 * cover the screen at z-50, and the end-interview control lives in the
 * transcript panel behind them. One control, rendered by both, so the two
 * exits cannot drift apart in wording, size or destination.
 *
 * The label is load-bearing: tests/e2e/interview-exit.spec.ts presses it at each
 * gate, and tests/unit/interview-exit.test.ts holds the wiring.
 */
export function LeaveRoomButton({ onExit }: { onExit: () => void }) {
  return (
    <button
      type="button"
      onClick={onExit}
      className="min-h-11 text-ui-xs font-medium text-muted-foreground hover:text-foreground underline-offset-4 hover:underline transition-all sm:min-h-0"
    >
      先不面试，返回控制台
    </button>
  );
}
