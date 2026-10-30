/**
 * What is left of today's AI allowance, as the browser last heard it.
 *
 * The server has always known this number — `checkUserBudget` runs on every
 * guarded call — but until now it only reached the client inside the 429 that
 * fires once the allowance is gone. A ceiling you discover by hitting it is
 * indistinguishable from a bug, which is why R7 asks for the number *before* it
 * runs out.
 *
 * Deliberately not React: `readApiJson` runs outside components, and the AI
 * transport wraps `fetch`. The store is a plain value plus listeners, and the
 * badge subscribes to it with `useSyncExternalStore`.
 */
export interface QuotaReading {
  /** AI calls left today for this caller, after the call that reported it. */
  remaining: number;
  /** Seconds until the allowance resets (PT midnight). */
  resetSeconds: number;
}

let current: QuotaReading | null = null;
const listeners = new Set<(reading: QuotaReading | null) => void>();

/**
 * Read the two headers, or nothing.
 *
 * `null` means "this response said nothing about quota" — the honest answer for
 * an endpoint that opts out. It is never coerced to zero: a UI that shows "0 of
 * 200 left" because it could not find a header is worse than one that shows
 * nothing, because the user cannot tell the difference and will believe it.
 */
export function parseQuota(headers: Headers): QuotaReading | null {
  const remainingRaw = headers.get("RateLimit-Remaining");
  if (remainingRaw === null || remainingRaw.trim() === "") return null;
  const remaining = Number(remainingRaw);
  if (!Number.isFinite(remaining) || remaining < 0) return null;

  const resetRaw = headers.get("RateLimit-Reset");
  const reset = resetRaw === null ? 0 : Number(resetRaw);

  return {
    remaining: Math.floor(remaining),
    resetSeconds: Number.isFinite(reset) && reset > 0 ? Math.ceil(reset) : 0,
  };
}

/** Record a reading from a response, if it carries one. */
export function recordQuota(res: Response): void {
  const next = parseQuota(res.headers);
  if (!next) return;
  current = next;
  for (const listener of listeners) listener(next);
}

export function getQuota(): QuotaReading | null {
  return current;
}

export function subscribeQuota(listener: (reading: QuotaReading | null) => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Test seam: forget everything this module has seen. */
export function resetQuota(): void {
  current = null;
  listeners.clear();
}
