// Phase 7: interview-loop route integration (keyless: gate-level only).
import { describe, it, expect, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { resetRateLimits } from "../../src/lib/api/rate-limit";
import { signSession } from "../../src/lib/api/session";

process.env.SESSION_SECRET = "phase6-test-secret-0123456789abcdef";

import { POST as chat } from "../../src/app/api/interview-chat/route";

let ip = 0;
const freshIp = () => `10.60.0.${++ip}`;

async function cookie(): Promise<string> {
  const signed = await signSession(
    { id: "66666666-6666-6666-8666-666666666666", email: "l@t.st", username: "l" },
    process.env.SESSION_SECRET!
  );
  return `interveai_user=${encodeURIComponent(signed)}`;
}

function req(body: unknown, c: string): Request {
  return new Request("http://t/api/interview-chat", {
    method: "POST",
    headers: { "content-type": "application/json", cookie: c, "x-forwarded-for": freshIp() },
    body: JSON.stringify(body),
  });
}

beforeEach(() => resetRateLimits());

describe("interviewLoop contract", () => {
  it("accepts well-formed loop timing info", async () => {
    const c = await cookie();
    // Mock mode proves the gate accepts the shape end-to-end without keys.
    process.env.AI_MOCK = "1";
    try {
      const res = await chat(
        req({ messages: [{ role: "user", content: "hi" }], interviewLoop: { startedAt: Date.now() - 5000, timeBudgetSec: 900, difficulty: "medium" } }, c)
      );
      expect(res.status).toBe(200);
    } finally {
      delete process.env.AI_MOCK;
    }
  });

  it("rejects malformed loop info", async () => {
    const c = await cookie();
    const res = await chat(
      req({ messages: [{ role: "user", content: "hi" }], interviewLoop: { difficulty: 12345 } }, c)
    );
    expect(res.status).toBe(400);
  });

  it("short-answer probe is observable-only (static)", () => {
    const src = readFileSync(new URL("../../src/app/api/interview-chat/route.ts", import.meta.url), "utf8");
    expect(src).toContain("very short");
    expect(src).toContain("concrete example");
    expect(src).not.toMatch(/nervous|anxi|dishonest|lazy/i);
  });

  it("interview type selects tooling + rubric mapping (static)", () => {
    const src = readFileSync(new URL("../../src/app/api/interview-chat/route.ts", import.meta.url), "utf8");
    expect(src).toContain("Tooling note");
    const evalSrc = readFileSync(new URL("../../src/app/api/analyze-interview/route.ts", import.meta.url), "utf8");
    expect(evalSrc).toContain("getInterviewType");
  });
});
