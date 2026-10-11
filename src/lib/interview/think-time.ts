/**
 * The think-time window the room opens before a spoken answer.
 *
 * The countdown starts here and the calm-mode progress bar is sized by it. While
 * both lived in `src/app/interview/page.tsx` they were the same literal ten in the
 * same file; the overlay now lives in its own file, so the number needs one owner
 * or the two halves can drift and the bar lies about the time left.
 */
export const THINK_TIME_SECONDS = 10;

/** Calm-mode bar width for the seconds still on the clock. */
export function thinkTimeBarWidth(seconds: number): string {
  return `${(seconds / THINK_TIME_SECONDS) * 100}%`;
}
