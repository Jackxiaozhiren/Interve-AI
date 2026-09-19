// Phase B6: per-user daily AI-call budget (Unbounded Consumption熔断).
//
// Complements the per-IP abuse limiter (rate-limit.ts): even an
// authenticated user cycling IPs cannot burn the shared free-tier quota.
// Single-instance in-memory design (same caveat as rate-limit.ts —
// multi-instance needs a shared store; tracked as follow-up).
//
// Window: PT calendar day (same RPD reset as providers + C1 ledger).
// Keyed by route + session user id (pseudonymous UUID). The id is NEVER
// logged — observability is route/requestId/status/reason + remaining.
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

export function checkUserBudget(
  route: string,
  userId: string,
  limit = defaultUserBudget(),
  now = new Date()
): UserBudgetResult {
  const window = ptDayKey(now);
  const mapKey = `${route}:${userId}`;
  if (buckets.size > MAX_BUCKETS) {
    for (const [k, b] of buckets) {
      if (b.window !== window) buckets.delete(k);
      if (buckets.size <= MAX_BUCKETS / 2) break;
    }
  }
  let bucket = buckets.get(mapKey);
  if (!bucket || bucket.window !== window) {
    bucket = { window, count: 0 };
    buckets.set(mapKey, bucket);
  }
  if (bucket.count < limit) {
    bucket.count += 1;
    return { allowed: true, remaining: limit - bucket.count, resetMs: Math.max(0, nextPtMidnight(now).getTime() - now.getTime()) };
  }
  return { allowed: false, remaining: 0, resetMs: Math.max(0, nextPtMidnight(now).getTime() - now.getTime()) };
}

/** Test hook: clears all buckets. */
export function resetUserBudgets(): void {
  buckets.clear();
}
