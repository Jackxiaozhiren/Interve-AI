import { describe, expect, it, vi, beforeEach } from "vitest";

process.env.SESSION_SECRET = "parse-resume-budget-secret-01234567";

const logApi = vi.fn();
vi.mock("@/lib/api/logging", () => ({
  logApi: (...args: unknown[]) => logApi(...args),
  usageOf: (u: unknown) => ({ inputTokens: (u as { promptTokens?: number })?.promptTokens }),
}));

const { signSession } = await import("@/lib/api/session");
const { resetRateLimits: resetRl } = await import("@/lib/api/rate-limit");

async function cookie(): Promise<string> {
  const signed = await signSession(
    { id: "33333333-3333-4333-8333-333333333333", email: "resume@test.local", username: "resume" },
    process.env.SESSION_SECRET!
  );
  return `interveai_user=${encodeURIComponent(signed)}`;
}

let ip = 0;
function pdfReq(bytes: number[]): Request {
  const form = new FormData();
  form.append("file", new File([new Uint8Array(bytes)], "resume.pdf", { type: "application/pdf" }));
  return new Request("http://test/api/parse-resume", {
    method: "POST",
    headers: { cookie: "", "x-forwarded-for": `10.30.0.${++ip}` },
    body: form,
  });
}

beforeEach(() => {
  logApi.mockClear();
  resetRl();
});

/**
 * parse-resume is the only model-calling route in the app that declared neither
 * a runtime nor a duration budget, and it is the one that must run Node code
 * (pdf-parse) and may additionally call a vision model for OCR. On the platform
 * a function killed by the default duration limit does not return the app's
 * JSON error envelope, so the client's `res.json()` throws and the user sees a
 * generic "Parsing Error" with no status anywhere. Sibling routes already carry
 * 60-170s budgets; these assert parse-resume does too.
 */
describe("parse-resume function budget", () => {
  it("runs on the Node runtime, which pdf-parse requires", async () => {
    const route = await import("@/app/api/parse-resume/route");
    expect(route.runtime).toBe("nodejs");
  });

  it("declares a duration that can outlast an OCR round trip", async () => {
    const route = await import("@/app/api/parse-resume/route");
    expect(typeof route.maxDuration).toBe("number");
    expect(route.maxDuration).toBeGreaterThanOrEqual(60);
  });
});

describe("parse-resume failure reporting", () => {
  it("answers a corrupted PDF with the JSON envelope, not a thrown body", async () => {
    // Green before the fix as well: it is a guard on the contract the client
    // depends on, not the change driver. The next test is the one that binds.
    const route = await import("@/app/api/parse-resume/route");
    const req = pdfReq([0x25, 0x50, 0x44, 0x46, 0x00, 0x00]);
    req.headers.set("cookie", await cookie());
    const res = await route.POST(req);
    const body = await res.json();
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(body.error?.code).toBe("INTERNAL");
  });

  it("names the underlying error in the log line instead of swallowing it", async () => {
    // The route's catch block was `catch { ... }` with a fixed reason of
    // "internal", so a production 500 left nothing to diagnose — which is
    // exactly how the Chinese-resume timeout stayed invisible.
    const route = await import("@/app/api/parse-resume/route");
    const req = pdfReq([0x25, 0x50, 0x44, 0x46, 0x00, 0x00]);
    req.headers.set("cookie", await cookie());
    await route.POST(req);

    const call = logApi.mock.calls.find((c) => (c[1] as { status?: number }).status === 500);
    expect(call, "no 500 was logged").toBeTruthy();
    const reason = String((call![1] as { reason?: string }).reason ?? "");
    expect(reason, `reason stayed generic: "${reason}"`).not.toBe("internal");
    expect(reason.length).toBeGreaterThan("internal".length);
  });
});
