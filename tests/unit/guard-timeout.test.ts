// P1-01 (BUG-R-guard-timeout): guard 超时在 edge 下静默不执行 + practice lane 预算。
// 根因：combineSignal 依赖 AbortSignal.any，缺失时回落为纯 client 信号（timer 丢弃）。
// TDD RED：本文件先行，生产代码未改时第 1、3 条必须失败。
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { z } from "zod";
import { guardRequest } from "../../src/lib/api/guard";
import { resetRateLimits } from "../../src/lib/api/rate-limit";
import { resetUserBudgets } from "../../src/lib/api/user-budget";
import { signSession } from "../../src/lib/api/session";

const schema = z.object({ q: z.string().min(1) });
let ip = 0;

async function authedGate(timeoutMs?: number) {
  const signed = await signSession(
    { id: "c1c1c1c1-c1c1-41c1-81c1-c1c1c1c1c1c1", email: "c1@t.st", username: "c1" },
    process.env.SESSION_SECRET!
  );
  return guardRequest(
    new Request("http://test/api/c1", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-forwarded-for": `10.61.0.${++ip}`,
        cookie: `interveai_user=${encodeURIComponent(signed)}`,
      },
      body: JSON.stringify({ q: "hi" }),
    }),
    {
      route: "c1-route",
      schema,
      maxBytes: 4096,
      rateLimit: { limit: 1000, windowMs: 60_000 },
      userBudget: false,
      ...(timeoutMs === undefined ? {} : { timeoutMs }),
    }
  );
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

describe("guard timeout budget (BUG-R-guard-timeout)", () => {
  const savedAny = AbortSignal.any;
  const savedSecret = process.env.SESSION_SECRET;

  beforeEach(() => {
    process.env.SESSION_SECRET = "c1-test-secret-0123456789abcdef";
    resetUserBudgets();
    resetRateLimits();
  });

  afterEach(() => {
    AbortSignal.any = savedAny;
    if (savedSecret === undefined) delete process.env.SESSION_SECRET;
    else process.env.SESSION_SECRET = savedSecret;
  });

  it("enforces the timeout even when AbortSignal.any is missing (edge)", async () => {
    // 模拟 edge：删除 AbortSignal.any，timer 预算仍须执行。
    (AbortSignal as unknown as Record<string, unknown>).any = undefined;
    const gate = await authedGate(120);
    if (!gate.ok) throw new Error(`gate rejected: ${gate.response.status}`);
    expect(gate.ctx.signal.aborted).toBe(false);
    await sleep(400);
    expect(gate.ctx.signal.aborted).toBe(true);
  });

  it("propagates a client abort before the timeout", async () => {
    const signed = await signSession(
      { id: "c1c1c1c1-c1c1-41c1-81c1-c1c1c1c1c1c1", email: "c1@t.st", username: "c1" },
      process.env.SESSION_SECRET!
    );
    const controller = new AbortController();
    const gate = await guardRequest(
      new Request("http://test/api/c1", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-forwarded-for": `10.61.0.${++ip}`,
          cookie: `interveai_user=${encodeURIComponent(signed)}`,
        },
        body: JSON.stringify({ q: "hi" }),
        signal: controller.signal,
      }),
      {
        route: "c1-route",
        schema,
        maxBytes: 4096,
        rateLimit: { limit: 1000, windowMs: 60_000 },
        userBudget: false,
        timeoutMs: 60_000,
      }
    );
    if (!gate.ok) throw new Error(`gate rejected: ${gate.response.status}`);
    controller.abort();
    await sleep(10);
    expect(gate.ctx.signal.aborted).toBe(true);
  });

  it("practice lane budget is 45s (below maxDuration 60s)", async () => {
    const route = await import("../../src/app/api/analyze-practice/route");
    expect(route.PRACTICE_TIMEOUT_MS).toBe(45_000);
  });
});
