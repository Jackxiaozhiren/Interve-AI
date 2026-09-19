// Phase C2: degradation-matrix fault injection (keyless, zero quota).
//
// Matrix under test (V3 Phase C2):
//   upstream 500/429/timeout → model fallback (exactly once) → thin 422
//   floor (analyze-interview) → [cache hit: DEFERRED, see below] → mock
//   tier (x-mock header, pinned by mock-contract.test.ts) → explicit typed
//   error (UPSTREAM_ERROR / THIN_TRANSCRIPT, never a bare 500).
//
// Cache tier deferred with basis: no response cache exists anywhere in
// src/ (verified 2026-09-17). Serving stale evals on upstream failure would
// change user-visible semantics (stale readiness/verdicts) — a product
// decision, not a reliability patch. Build it only if keyed nightly data
// shows retry storms on identical inputs (Phase A2 trend JSON), keyed by
// route + input hash + prompt version. Until then retry → fallback →
// mock → typed error covers the matrix.
//
// Fault injection is route-level (real POST handlers, mocked `ai` SDK) so
// every cell below exercises production wiring, not copies of it.
import { describe, it, expect, beforeEach, vi } from "vitest";
import { generateObject, generateText } from "ai";
import { signSession } from "../../src/lib/api/session";
import { resetRateLimits } from "../../src/lib/api/rate-limit";
import { withModelFallback, estimateVisibleFailureRate } from "../../src/ai/providers/fallback";
import { POST as practicePost } from "../../src/app/api/analyze-practice/route";
import { POST as interviewPost } from "../../src/app/api/analyze-interview/route";
import { POST as trendsPost } from "../../src/app/api/analyze-trends/route";

vi.mock("ai", () => ({
  generateObject: vi.fn(),
  generateText: vi.fn(),
  // Real-brand coverage lives in classify-error.test.ts (unmocked);
  // here the predicate only needs to exist and decline.
  NoObjectGeneratedError: { isInstance: () => false },
}));

process.env.SESSION_SECRET = "c2-test-secret-0123456789abcdef";

let ipCounter = 0;
const freshIp = () => `10.77.0.${++ipCounter}`;

async function signedCookie(): Promise<string> {
  const signed = await signSession(
    { id: "33333333-3333-4333-8333-333333333333", email: "c2@t.st", username: "c2" },
    process.env.SESSION_SECRET!
  );
  return `interveai_user=${encodeURIComponent(signed)}`;
}

async function authedReq(body: unknown): Promise<Request> {
  return new Request("http://test/api/x", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-forwarded-for": freshIp(),
      cookie: await signedCookie(),
    },
    body: JSON.stringify(body),
  });
}

function upstreamError(kind: "flaky-500" | "rate-limited-429" | "timeout"): Error {
  if (kind === "rate-limited-429") return Object.assign(new Error("upstream 429 Too Many Requests"), { statusCode: 429 });
  if (kind === "timeout") return Object.assign(new Error("The operation was aborted"), { name: "AbortError" });
  return Object.assign(new Error("upstream 500 Internal Server Error"), { statusCode: 500 });
}

async function runFallbackWith(kind: "flaky-500" | "rate-limited-429" | "timeout" | "dual-failure") {
  let attempts = 0;
  const outcome = await withModelFallback({
    route: "c2",
    requestId: "c2",
    startTime: performance.now(),
    primaryModel: { id: "primary" } as never,
    primaryModelId: "primary-x",
    run: async () => {
      attempts += 1;
      if (kind === "dual-failure" || attempts === 1) throw upstreamError(kind === "dual-failure" ? "flaky-500" : kind);
      return "fallback-value";
    },
  });
  return { outcome, attempts };
}

beforeEach(() => {
  resetRateLimits();
  vi.resetAllMocks(); // drop implementations too: each test owns its fault
  delete process.env.AI_MOCK;
});

describe("fallback tier: every upstream failure class gets exactly one fallback", () => {
  for (const kind of ["flaky-500", "rate-limited-429", "timeout"] as const) {
    it(`${kind} → fallback succeeds, total attempts bounded at 2`, async () => {
      const { outcome, attempts } = await runFallbackWith(kind);
      expect(outcome).toEqual({ value: "fallback-value", modelId: "glm-4-flash", fallback: true });
      expect(attempts).toBe(2);
    });
  }

  it("dual failure rejects (caller maps to typed 500, never hangs)", async () => {
    await expect(runFallbackWith("dual-failure")).rejects.toThrow("upstream 500");
  });
});

describe("route tier: injected upstream failures map to typed statuses", () => {
  it("analyze-practice 500 → 500 UPSTREAM_ERROR with requestId (explicit error, never bare)", async () => {
    vi.mocked(generateObject).mockRejectedValueOnce(upstreamError("flaky-500"));
    const res = await practicePost(
      await authedReq({ question: { title: "Tell me about a conflict." }, answer: "We talked it out over two weeks." })
    );
    expect(res.status).toBe(500);
    const body = (await res.json()) as { error: { code: string }; requestId: string };
    expect(body.error.code).toBe("UPSTREAM_ERROR");
    expect(typeof body.requestId).toBe("string");
  });

  it("analyze-practice 429 → same typed 500 path (no special-case swallow)", async () => {
    vi.mocked(generateObject).mockRejectedValueOnce(upstreamError("rate-limited-429"));
    const res = await practicePost(
      await authedReq({ question: { title: "Tell me about a conflict." }, answer: "We talked it out over two weeks." })
    );
    expect(res.status).toBe(500);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe("UPSTREAM_ERROR");
  });

  it("analyze-interview evidence-less dims → 422 THIN_TRANSCRIPT (retry guidance, not failure)", async () => {
    const thinText = JSON.stringify({ dimensions: [{ id: "relevance", score: 2, evidence: [] }] });
    // Persistent: thin transcripts fail deterministically on primary AND fallback.
    vi.mocked(generateObject).mockRejectedValue(Object.assign(new Error("NoObjectGenerated"), { text: thinText }));
    const res = await interviewPost(
      await authedReq({ messages: [{ role: "user", content: "idk, stuff happened, it was fine" }] })
    );
    expect(res.status).toBe(422);
    const body = (await res.json()) as { error: { code: string; message: string } };
    expect(body.error.code).toBe("THIN_TRANSCRIPT");
    expect(body.error.message).toMatch(/retry/i);
  });

  it("analyze-interview generic upstream failure → 500 UPSTREAM_ERROR (thin detector does not misfire)", async () => {
    vi.mocked(generateObject).mockRejectedValue(upstreamError("flaky-500"));
    const res = await interviewPost(await authedReq({ messages: [{ role: "user", content: "A real answer with substance." }] }));
    expect(res.status).toBe(500);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe("UPSTREAM_ERROR");
  });

  it("analyze-trends provider failure → 200 fallbackData (degraded content, not an error)", async () => {
    vi.mocked(generateText).mockRejectedValueOnce(upstreamError("timeout"));
    const res = await trendsPost(await authedReq({ sessions: [{ title: "s1" }] }));
    expect(res.status).toBe(200);
    const body = (await res.json()) as { recurringFlaws: string[]; growthActionPlan: string };
    expect(body.recurringFlaws.length).toBeGreaterThan(0);
    expect(typeof body.growthActionPlan).toBe("string");
  });
});

describe("quantified 500-rate: one fallback squares the user-visible rate", () => {
  it("p² clears the halve-the-500-rate bar at §5's measured p ≈ 3/31", () => {
    const p = 3 / 31; // §5: 3 flaky 500s in 31 flash calls
    const visible = estimateVisibleFailureRate(p);
    expect(visible).toBeCloseTo(0.0094, 3);
    expect(visible).toBeLessThanOrEqual(p / 2); // "减半" target with ~5× margin
  });

  it("halving holds across the plausible free-tier range", () => {
    for (const p of [0.01, 0.05, 0.1, 0.2]) {
      expect(estimateVisibleFailureRate(p)).toBeLessThanOrEqual(p / 2);
    }
    expect(estimateVisibleFailureRate(0)).toBe(0);
    expect(estimateVisibleFailureRate(1)).toBe(1);
  });

  it("rejects out-of-range inputs instead of silently squaring them", () => {
    expect(() => estimateVisibleFailureRate(-0.1)).toThrow();
    expect(() => estimateVisibleFailureRate(1.5)).toThrow();
    expect(() => estimateVisibleFailureRate(Number.NaN)).toThrow();
  });
});
