// Phase 2 API hardening: per-route fixed-window rate limiting (P0-3).
//
// Single-instance in-memory design (Map). Correct for `next start`
// standalone and dev; multi-instance deployments need a shared store
// (Upstash Redis) — tracked in STABILIZATION_REPORT as Phase 3 work.
// Keying is by client IP (x-forwarded-for first entry) so anonymous floods
// are bounded even before session verification.

export interface RateLimitRule {
  limit: number;
  windowMs: number;
}

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();
const MAX_BUCKETS = 20000;

export function getClientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) {
    const first = fwd.split(",")[0]?.trim();
    if (first) return first.slice(0, 64);
  }
  return "unknown";
}

export function checkRateLimit(
  route: string,
  key: string,
  rule: RateLimitRule,
  now = Date.now()
): { allowed: boolean; remaining: number; resetMs: number; retryAfterMs: number } {
  const mapKey = `${route}:${key}`;
  // Opportunistic eviction to bound memory.
  if (buckets.size > MAX_BUCKETS) {
    for (const [k, b] of buckets) {
      if (b.resetAt <= now) buckets.delete(k);
      if (buckets.size <= MAX_BUCKETS / 2) break;
    }
  }
  let bucket = buckets.get(mapKey);
  if (!bucket || bucket.resetAt <= now) {
    bucket = { count: 0, resetAt: now + rule.windowMs };
    buckets.set(mapKey, bucket);
  }
  if (bucket.count < rule.limit) {
    bucket.count += 1;
    return {
      allowed: true,
      remaining: rule.limit - bucket.count,
      resetMs: bucket.resetAt - now,
      retryAfterMs: 0,
    };
  }
  return {
    allowed: false,
    remaining: 0,
    resetMs: Math.max(0, bucket.resetAt - now),
    retryAfterMs: Math.max(0, bucket.resetAt - now),
  };
}

/** Test hook: clears all buckets. */
export function resetRateLimits(): void {
  buckets.clear();
}
