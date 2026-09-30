// Phase 2: rate limiter unit tests (P0-3).
import { describe, it, expect, beforeEach } from "vitest";
import { checkRateLimit, resetRateLimits, getClientIp } from "../../src/lib/api/rate-limit";

beforeEach(() => resetRateLimits());

describe("checkRateLimit", () => {
  it("allows up to the limit then blocks", () => {
    const rule = { limit: 3, windowMs: 60_000 };
    expect(checkRateLimit("r", "k", rule).allowed).toBe(true);
    expect(checkRateLimit("r", "k", rule).allowed).toBe(true);
    expect(checkRateLimit("r", "k", rule).allowed).toBe(true);
    const blocked = checkRateLimit("r", "k", rule);
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterMs).toBeGreaterThan(0);
  });

  it("isolates buckets per route+key", () => {
    const rule = { limit: 1, windowMs: 60_000 };
    expect(checkRateLimit("a", "k", rule).allowed).toBe(true);
    expect(checkRateLimit("a", "k", rule).allowed).toBe(false);
    expect(checkRateLimit("b", "k", rule).allowed).toBe(true);
    expect(checkRateLimit("a", "other", rule).allowed).toBe(true);
  });

  it("resets after the window", () => {
    const rule = { limit: 1, windowMs: 1000 };
    expect(checkRateLimit("r", "k", rule, 0).allowed).toBe(true);
    expect(checkRateLimit("r", "k", rule, 500).allowed).toBe(false);
    expect(checkRateLimit("r", "k", rule, 1001).allowed).toBe(true);
  });
});

describe("getClientIp", () => {
  it("uses the x-forwarded-for first entry", () => {
    const req = new Request("http://x/", { headers: { "x-forwarded-for": "1.2.3.4, 5.6.7.8" } });
    expect(getClientIp(req)).toBe("1.2.3.4");
  });

  it("prefers the header a proxy on top of the platform cannot rewrite", () => {
    // x-forwarded-for is overwritten by Vercel so a client cannot spoof it; the
    // Vercel-specific copy is the one that survives an added proxy, so it wins
    // when both are present.
    const req = new Request("http://x/", {
      headers: { "x-vercel-forwarded-for": "9.9.9.9", "x-forwarded-for": "1.2.3.4" },
    });
    expect(getClientIp(req)).toBe("9.9.9.9");
  });

  it("has no per-caller key at all off-platform, and says so with one shared bucket", () => {
    expect(getClientIp(new Request("http://x/"))).toBe("unknown");
    expect(
      getClientIp(new Request("http://x/", { headers: { "x-forwarded-for": "   " } })),
    ).toBe("unknown");
  });

  it("caps the key length so a hostile header cannot bloat the bucket map", () => {
    const req = new Request("http://x/", { headers: { "x-forwarded-for": "a".repeat(500) } });
    expect(getClientIp(req)).toHaveLength(64);
  });
});
