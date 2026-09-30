// Phase B6: per-user daily AI-call budget (keyless, zero quota).
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { z } from "zod";
import {
  checkUserBudget,
  defaultUserBudget,
  nextPtMidnight,
  ptDayKey,
  resetUserBudgets,
} from "../../src/lib/api/user-budget";
import { guardRequest } from "../../src/lib/api/guard";
import { resetRateLimits } from "../../src/lib/api/rate-limit";
import { signSession } from "../../src/lib/api/session";

beforeEach(() => {
  resetUserBudgets();
  resetRateLimits();
});

describe("checkUserBudget", () => {
  it("allows limit calls, then denies with a PT-midnight reset", () => {
    const now = new Date("2026-09-17T12:00:00.000Z");
    expect(checkUserBudget("r", ["u1"], 2, now).allowed).toBe(true);
    const second = checkUserBudget("r", ["u1"], 2, now);
    expect(second.allowed).toBe(true);
    expect(second.remaining).toBe(0);
    const third = checkUserBudget("r", ["u1"], 2, now);
    expect(third.allowed).toBe(false);
    expect(third.remaining).toBe(0);
    expect(third.resetMs).toBeGreaterThan(0);
    expect(third.resetMs).toBeLessThanOrEqual(25 * 3600 * 1000);
  });

  it("isolates subjects and routes", () => {
    const now = new Date("2026-09-17T12:00:00.000Z");
    checkUserBudget("r", ["u1"], 1, now);
    expect(checkUserBudget("r", ["u1"], 1, now).allowed).toBe(false);
    expect(checkUserBudget("r", ["u2"], 1, now).allowed).toBe(true);
    expect(checkUserBudget("other", ["u1"], 1, now).allowed).toBe(true);
  });

  it("rolls over on the next PT day", () => {
    const tue = new Date("2026-09-17T12:00:00.000Z"); // PT 09-17
    const wed = new Date("2026-09-18T12:00:00.000Z"); // PT 09-18
    expect(ptDayKey(tue)).not.toBe(ptDayKey(wed));
    checkUserBudget("r", ["u1"], 1, tue);
    expect(checkUserBudget("r", ["u1"], 1, tue).allowed).toBe(false);
    expect(checkUserBudget("r", ["u1"], 1, wed).allowed).toBe(true);
  });

  /**
   * The identity inside the session cookie is chosen by whoever calls
   * POST /api/session — that endpoint verifies nothing (reproduced against a
   * local dev server: mint id A -> 200 200 429, mint id B seconds later -> 200).
   * So a user-id-only ceiling is not a ceiling: the module header's promise
   * that an attacker cannot burn the shared free-tier quota holds only once the
   * same budget is also bound to something the caller does not control.
   */
  it("does not let a fresh identity multiply one client's quota", () => {
    const now = new Date("2026-09-17T12:00:00.000Z");
    const ip = "203.0.113.7";
    expect(checkUserBudget("r", ["u1", ip], 2, now).allowed).toBe(true);
    expect(checkUserBudget("r", ["u2", ip], 2, now).allowed).toBe(true);
    expect(checkUserBudget("r", ["u3", ip], 2, now).allowed).toBe(false);
  });

  it("keeps one identity usable when its client changes network", () => {
    const now = new Date("2026-09-17T12:00:00.000Z");
    checkUserBudget("r", ["u1", "198.51.100.1"], 2, now);
    // Same candidate, now on hotspot. The shared identity bucket has one call
    // left, and the new IP has never been seen — so this must not be denied.
    expect(checkUserBudget("r", ["u1", "198.51.100.2"], 2, now).allowed).toBe(true);
  });

  it("consumes nothing when it denies", () => {
    const now = new Date("2026-09-17T12:00:00.000Z");
    checkUserBudget("r", ["u1", "ip-a"], 1, now);
    expect(checkUserBudget("r", ["u2", "ip-a"], 1, now).allowed).toBe(false);
    // u2 was refused because of ip-a, so its own bucket must still be empty.
    expect(checkUserBudget("r", ["u2", "ip-b"], 1, now).allowed).toBe(true);
  });

  it("nextPtMidnight lands on the coming flip", () => {
    const now = new Date("2026-09-17T12:00:00.000Z");
    const next = nextPtMidnight(now);
    expect(next.getTime()).toBeGreaterThan(now.getTime());
    expect(ptDayKey(next)).not.toBe(ptDayKey(now));
    expect(next.getTime() - now.getTime()).toBeLessThanOrEqual(25 * 3600 * 1000);
  });
});

describe("defaultUserBudget", () => {
  const saved = process.env.USER_AI_BUDGET_RPD;
  afterEach(() => {
    if (saved === undefined) delete process.env.USER_AI_BUDGET_RPD;
    else process.env.USER_AI_BUDGET_RPD = saved;
  });

  it("defaults to 200; env wins; garbage falls back", () => {
    delete process.env.USER_AI_BUDGET_RPD;
    expect(defaultUserBudget()).toBe(200);
    process.env.USER_AI_BUDGET_RPD = "5";
    expect(defaultUserBudget()).toBe(5);
    process.env.USER_AI_BUDGET_RPD = "nope";
    expect(defaultUserBudget()).toBe(200);
  });
});

describe("guardRequest budget gate", () => {
  const schema = z.object({ q: z.string().min(1) });
  let ip = 0;

  async function authedCall(userBudget?: { limit?: number } | false): Promise<Response> {
    const signed = await signSession(
      { id: "b6b6b6b6-b6b6-46b6-86b6-b6b6b6b6b6b6", email: "b6@t.st", username: "b6" },
      process.env.SESSION_SECRET!
    );
    const gate = await guardRequest(
      new Request("http://test/api/b6", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-forwarded-for": `10.60.0.${++ip}`,
          cookie: `interveai_user=${encodeURIComponent(signed)}`,
        },
        body: JSON.stringify({ q: "hi" }),
      }),
      {
        route: "b6-route",
        schema,
        maxBytes: 4096,
        rateLimit: { limit: 1000, windowMs: 60_000 },
        ...(userBudget === undefined ? {} : { userBudget }),
      }
    );
    if (!gate.ok) return gate.response;
    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  }

  beforeEach(() => {
    process.env.SESSION_SECRET = "b6-test-secret-0123456789abcdef";
  });

  it("denies the (limit+1)-th call with 429 + Retry-After (explicit limit)", async () => {
    expect((await authedCall({ limit: 2 })).status).toBe(200);
    expect((await authedCall({ limit: 2 })).status).toBe(200);
    const denied = await authedCall({ limit: 2 });
    expect(denied.status).toBe(429);
    const body = (await denied.json()) as { error: { code: string } };
    expect(body.error.code).toBe("RATE_LIMITED");
    expect(Number(denied.headers.get("Retry-After"))).toBeGreaterThan(0);
  });

  it("is ON by default via USER_AI_BUDGET_RPD; opt-out with false", async () => {
    process.env.USER_AI_BUDGET_RPD = "1";
    try {
      expect((await authedCall()).status).toBe(200);
      expect((await authedCall()).status).toBe(429);
      expect((await authedCall(false)).status).toBe(200);
    } finally {
      delete process.env.USER_AI_BUDGET_RPD;
    }
  });
});
