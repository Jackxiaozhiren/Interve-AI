// Phase B6: per-user daily AI-call budget (Unbounded Consumption熔断).
//
// Complements the per-IP abuse limiter (rate-limit.ts): even an
// authenticated user cycling IPs cannot burn the shared free-tier quota.
// Single-instance in-memory design (same caveat as rate-limit.ts —
// multi-instance needs a shared store; tracked as follow-up).
//
// Window: PT calendar day (same RPD reset as providers + C1 ledger).
// Keyed by route + every attribution subject (session user id AND client IP).
// Neither id is logged — observability is route/requestId/status/reason +
// remaining.
const ptDayFmt = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Los_Angeles",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

export function ptDayKey(now = new Date()): string {
  return ptDayFmt.format(now);
}

/** Default daily budget per user per route (generous; tighten via env). */
export function defaultUserBudget(): number {
  const raw = process.env.USER_AI_BUDGET_RPD;
  const parsed = raw === undefined || raw === "" ? NaN : Number.parseInt(raw, 10);
  if (!Number.isInteger(parsed) || parsed <= 0) return 200;
  return parsed;
}

interface Bucket {
  window: string;
  count: number;
}

const buckets = new Map<string, Bucket>();
const MAX_BUCKETS = 20000;

export interface UserBudgetResult {
  allowed: boolean;
  remaining: number;
  /** ms until the PT-day window rolls over (for Retry-After). */
  resetMs: number;
}

/** Next PT midnight as a Date (for Retry-After computation). */
export function nextPtMidnight(now = new Date()): Date {
  // Walk forward in 6h steps until the PT day key flips (cheap, no TZ math).
  const probe = new Date(now.getTime());
  const key = ptDayKey(now);
  for (let i = 0; i < 8; i++) {
    probe.setTime(probe.getTime() + 6 * 3600 * 1000);
    if (ptDayKey(probe) !== key) break;
  }
  // Binary-search the flip within the last 6h step (1-minute resolution).
  let lo = probe.getTime() - 6 * 3600 * 1000;
  let hi = probe.getTime();
  while (hi - lo > 60 * 1000) {
    const mid = Math.floor((lo + hi) / 2);
    if (ptDayKey(new Date(mid)) !== key) hi = mid;
    else lo = mid;
  }
  return new Date(hi);
}

/**
 * Daily AI-call ceiling for one caller, expressed as every subject the request
 * can be attributed to — the session user id and the client IP.
 *
 * All subjects are checked before any is incremented, and the call is refused
 * when the *first* to run out does. Passing only the user id made the ceiling
 * trivially inflatable: POST /api/session mints a cookie for any identity the
 * caller types, so a script could take a fresh 200-call allowance per guessed
 * UUID (measured locally: one identity went 200/200/429, a second minted
 * seconds later from the same process returned 200). Binding the same budget to
 * the IP closes that, which is what the header's "cycling IPs cannot burn the
 * quota" claim always assumed.
 *
 * The cost is honest and worth naming: a shared egress (campus, office, carrier
 * NAT) splits one day's allowance among everyone behind it. USER_AI_BUDGET_RPD
 * is the knob; the per-minute per-route limiter is unaffected.
 */
export function checkUserBudget(
  route: string,
  subjects: string[],
  limit = defaultUserBudget(),
  now = new Date()
): UserBudgetResult {
  const window = ptDayKey(now);
  const resetMs = Math.max(0, nextPtMidnight(now).getTime() - now.getTime());
  if (subjects.length === 0) {
    return { allowed: false, remaining: 0, resetMs };
  }
  const keys = subjects.map((subject) => `${route}:${subject}`);

  if (buckets.size > MAX_BUCKETS) {
    for (const [k, b] of buckets) {
      if (b.window !== window) buckets.delete(k);
      if (buckets.size <= MAX_BUCKETS / 2) break;
    }
  }

  const open = (key: string): Bucket => {
    const existing = buckets.get(key);
    if (existing && existing.window === window) return existing;
    const fresh = { window, count: 0 };
    buckets.set(key, fresh);
    return fresh;
  };

  // Deny from the most-constrained subject without incrementing anything.
  const counts = keys.map((key) => open(key).count);
  if (counts.some((count) => count >= limit)) {
    return { allowed: false, remaining: 0, resetMs };
  }
  keys.forEach((key) => { open(key).count += 1; });
  return { allowed: true, remaining: limit - Math.max(...counts) - 1, resetMs };
}

/** Test hook: clears all buckets. */
export function resetUserBudgets(): void {
  buckets.clear();
}
