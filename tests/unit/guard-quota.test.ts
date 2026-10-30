// The daily AI budget is a ceiling the UI is supposed to show before the user
// reaches it (R7). Until now the only place it appeared was the 429 that fires
// when it is already gone (`guard.ts` budget rejection), so no surface could be
// built on it. This pins the value onto the success path.
//
// The "undefined when the route opts out" case is the one that matters most: an
// absent reading and a zero reading look identical to a careless UI, and "0 left"
// on a route that never had a budget is a lie the user cannot check.
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { z } from "zod";
import { guardRequest } from "../../src/lib/api/guard";
import { resetRateLimits } from "../../src/lib/api/rate-limit";
import { resetUserBudgets } from "../../src/lib/api/user-budget";
import { signSession } from "../../src/lib/api/session";

const schema = z.object({ q: z.string().min(1) });
let ip = 0;

async function call(options: { userBudget?: false | { limit?: number } }) {
  const signed = await signSession(
    { id: "d2d2d2d2-d2d2-42d2-82d2-d2d2d2d2d2d2", email: "d2@t.st", username: "d2" },
    process.env.SESSION_SECRET!
  );
  return guardRequest(
    new Request("http://test/api/d2", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-forwarded-for": `10.72.0.${++ip}`,
        cookie: `interveai_user=${encodeURIComponent(signed)}`,
      },
      body: JSON.stringify({ q: "hi" }),
    }),
    { route: "d2-route", schema, maxBytes: 4096, rateLimit: { limit: 1000, windowMs: 60_000 }, ...options }
  );
}

describe("the guard carries the remaining daily budget on success", () => {
  const saved = process.env.SESSION_SECRET;

  beforeEach(() => {
    process.env.SESSION_SECRET = "d2-test-secret-0123456789abcdef";
    resetUserBudgets();
    resetRateLimits();
  });

  afterEach(() => {
    if (saved === undefined) delete process.env.SESSION_SECRET;
    else process.env.SESSION_SECRET = saved;
  });

  it("reports what is left AFTER this call was counted", async () => {
    const gate = await call({ userBudget: { limit: 5 } });
    expect(gate.ok).toBe(true);
    if (!gate.ok) return;
    expect(gate.ctx.quota, "a budgeted route must expose its remaining allowance").toBeDefined();
    expect(gate.ctx.quota?.remaining).toBe(4);
    expect(gate.ctx.quota?.resetMs).toBeGreaterThan(0);
  });

  it("stays undefined when the route opts out, so a UI cannot render 0 as a real zero", async () => {
    const gate = await call({ userBudget: false });
    expect(gate.ok).toBe(true);
    if (!gate.ok) return;
    expect(gate.ctx.quota).toBeUndefined();
  });

  it("still refuses the call that would exceed the ceiling, and says so in the headers", async () => {
    await call({ userBudget: { limit: 1 } });
    const second = await call({ userBudget: { limit: 1 } });
    expect(second.ok).toBe(false);
    if (second.ok) return;
    expect(second.response.status).toBe(429);
    expect(second.response.headers.get("RateLimit-Remaining")).toBe("0");
  });
});
