// Phase 2 API hardening: per-route fixed-window rate limiting (P0-3).
//
// Single-instance in-memory design (Map). Correct for `next start`
// standalone and dev; multi-instance deployments need a shared store
// (Upstash Redis) — tracked in STABILIZATION_REPORT as Phase 3 work.
// Keying is by client IP so anonymous floods are bounded even before session
// verification.

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

/**
 * The abuse controls are only as good as this value, so the trust boundary is
 * stated rather than assumed:
 *
 * - Vercel overwrites the inbound `x-forwarded-for` with the real peer address
 *   and does not forward a client-supplied one — "This restriction is in place
 *   to prevent IP spoofing" (docs/headers/request-headers). Rotation of the
 *   session identity therefore cannot mint a fresh IP bucket in production.
 * - `x-vercel-forwarded-for` carries the same value and survives a proxy
 *   layered on top of Vercel, which would otherwise rewrite `x-forwarded-for`.
 *   Read first for that reason.
 * - With neither header (running outside the platform), callers collapse to a
 *   single shared bucket. That is deliberate: an unprovable per-caller key must
 *   not be read as a per-caller control. Anything deployed off-Vercel needs a
 *   trusted proxy or a shared store before these limits mean what they say.
 */
export function getClientIp(req: Request): string {
  for (const header of ["x-vercel-forwarded-for", "x-forwarded-for"]) {
    const fwd = req.headers.get(header);
    const first = fwd?.split(",")[0]?.trim();
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
