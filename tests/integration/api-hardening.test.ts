// Phase 2: API hardening contract tests (P0-3).
//
// These hit the real Route Handler POST functions but stop at the gate:
// 401/400/413/429 are all decided BEFORE any AI provider call, so no
// network or API keys are needed.
import { describe, it, expect, beforeEach } from "vitest";
import { signSession } from "../../src/lib/api/session";
import { resetRateLimits } from "../../src/lib/api/rate-limit";

process.env.SESSION_SECRET = "phase2-test-secret-0123456789abcdef";

import { POST as behavior } from "../../src/app/api/analyze-behavior/route";
import { POST as star } from "../../src/app/api/analyze-star/route";
import { POST as chunk } from "../../src/app/api/analyze-chunk/route";
import { POST as code } from "../../src/app/api/analyze-code/route";
import { POST as alignment } from "../../src/app/api/analyze-alignment/route";
import { POST as match } from "../../src/app/api/analyze-match/route";
import { POST as practice } from "../../src/app/api/analyze-practice/route";
import { POST as trends } from "../../src/app/api/analyze-trends/route";
import { POST as vision } from "../../src/app/api/analyze-vision/route";
import { POST as chat } from "../../src/app/api/interview-chat/route";
import { POST as copilot } from "../../src/app/api/copilot/route";
import { POST as hint } from "../../src/app/api/generate-hint/route";
import { POST as initCtx } from "../../src/app/api/init-context/route";
import { POST as parseJd } from "../../src/app/api/parse-jd/route";
import { POST as parseResume } from "../../src/app/api/parse-resume/route";
import { POST as sessionPost, GET as sessionGet } from "../../src/app/api/session/route";

const JSON_ROUTES = {
  behavior, star, chunk, code, alignment, match, practice, trends,
  vision, chat, copilot, hint, initCtx, parseJd,
} as const;

let ipCounter = 0;
const freshIp = () => `10.9.0.${++ipCounter}`;

async function signedCookie(): Promise<string> {
  const secret = process.env.SESSION_SECRET!;
  const signed = await signSession(
    { id: "22222222-2222-2222-2222-222222222222", email: "t@e.st", username: "t" },
    secret
  );
  return `interveai_user=${encodeURIComponent(signed)}`;
}

function jsonReq(body: unknown, opts: { cookie?: string; ip?: string } = {}): Request {
  const headers: Record<string, string> = {
    "content-type": "application/json",
    "x-forwarded-for": opts.ip ?? freshIp(),
  };
  if (opts.cookie) headers.cookie = opts.cookie;
  return new Request("http://test/api/x", { method: "POST", headers, body: JSON.stringify(body) });
}

beforeEach(() => resetRateLimits());

describe("authentication gate (401)", () => {
  for (const [name, post] of Object.entries(JSON_ROUTES)) {
    it(`${name}: rejects anonymous callers`, async () => {
      const res = await post(jsonReq({}));
      expect(res.status).toBe(401);
      const body = await res.json();
      expect(body.error.code).toBe("UNAUTHORIZED");
      expect(typeof body.requestId).toBe("string");
      expect(res.headers.get("x-request-id")).toBe(body.requestId);
    });
  }

  it("parse-resume: rejects anonymous callers", async () => {
    const res = await parseResume(new Request("http://test/api/parse-resume", { method: "POST" }));
    expect(res.status).toBe(401);
  });
});

describe("input validation gate (400)", () => {
  it("rejects empty JSON bodies on all JSON routes", async () => {
    const cookie = await signedCookie();
    for (const [name, post] of Object.entries(JSON_ROUTES)) {
      const res = await post(jsonReq({}, { cookie }));
      expect(res.status, name).toBe(400);
      const body = await res.json();
      expect(body.error.code, name).toBe("VALIDATION_FAILED");
    }
  });

  it("rejects malformed JSON", async () => {
    const cookie = await signedCookie();
    const req = new Request("http://test/api/x", {
      method: "POST",
      headers: { "content-type": "application/json", cookie, "x-forwarded-for": freshIp() },
      body: "{broken",
    });
    const res = await behavior(req);
    expect(res.status).toBe(400);
    expect((await res.json()).error.code).toBe("INVALID_JSON");
  });

  it("parse-jd: clamps uncontrolled questionCount", async () => {
    const cookie = await signedCookie();
    const res = await parseJd(jsonReq({ jobDescription: "Engineer", questionCount: 100 }, { cookie }));
    expect(res.status).toBe(400);
  });

  it("analyze-vision: refuses non-data URLs (no provider-side fetch)", async () => {
    const cookie = await signedCookie();
    const res = await vision(jsonReq({ imageBase64: "http://169.254.169.254/latest/meta-data/" }, { cookie }));
    expect(res.status).toBe(400);
  });

  it("parse-resume: requires a file", async () => {
    const cookie = await signedCookie();
    const res = await parseResume(
      new Request("http://test/api/parse-resume", { method: "POST", headers: { cookie }, body: new FormData() })
    );
    expect(res.status).toBe(400);
  });
});

describe("payload caps (413)", () => {
  it("rejects oversized JSON before the provider", async () => {
    const cookie = await signedCookie();
    const res = await behavior(jsonReq({ transcript: "x".repeat(300_000) }, { cookie }));
    expect(res.status).toBe(413);
    expect((await res.json()).error.code).toBe("PAYLOAD_TOO_LARGE");
  });

  it("parse-resume: rejects >5MB files server-side", async () => {
    const cookie = await signedCookie();
    const fd = new FormData();
    fd.append("file", new File([new Uint8Array(6 * 1024 * 1024)], "r.pdf", { type: "application/pdf" }));
    const res = await parseResume(new Request("http://test/api/parse-resume", { method: "POST", headers: { cookie }, body: fd }));
    expect(res.status).toBe(413);
  });

  it("parse-resume: refuses SVG uploads", async () => {
    const cookie = await signedCookie();
    const fd = new FormData();
    fd.append("file", new File(["<svg></svg>"], "x.svg", { type: "image/svg+xml" }));
    const res = await parseResume(new Request("http://test/api/parse-resume", { method: "POST", headers: { cookie }, body: fd }));
    expect(res.status).toBe(400);
  });

  it("parse-resume: catches content-length lies (header small, body big)", async () => {
    const cookie = await signedCookie();
    const fd = new FormData();
    fd.append("file", new File([new Uint8Array(6 * 1024 * 1024)], "r.pdf", { type: "application/pdf" }));
    const res = await parseResume(
      new Request("http://test/api/parse-resume", {
        method: "POST",
        headers: { cookie, "content-length": "100" },
        body: fd as unknown as BodyInit,
      })
    );
    // undici may recompute content-length; either the fast path or the
    // actual-byte check must refuse.
    expect(res.status).toBe(413);
  });

  it("parse-resume: rejects non-document types", async () => {
    const cookie = await signedCookie();
    const fd = new FormData();
    fd.append("file", new File(["x"], "x.txt", { type: "text/plain" }));
    const res = await parseResume(new Request("http://test/api/parse-resume", { method: "POST", headers: { cookie }, body: fd }));
    expect(res.status).toBe(400);
  });
});

describe("rate limiting (429)", () => {
  it("bounds anonymous floods per IP before any AI call", async () => {
    const ip = freshIp();
    let last: Response | null = null;
    // analyze-behavior allows 30/min: the 31st identical anonymous hit trips.
    for (let i = 0; i < 31; i++) {
      last = await behavior(jsonReq({}, { ip }));
      await last.json().catch(() => null);
    }
    expect(last!.status).toBe(429);
    expect(last!.headers.get("Retry-After")).toBeTruthy();
    expect(last!.headers.get("x-request-id")).toBeTruthy();
  });
});

describe("session endpoint", () => {
  it("issues verifiable sessions and rejects bad identities", async () => {
    const bad = await sessionPost(jsonReq({ id: "not-a-uuid", email: "x", username: "" }));
    expect(bad.status).toBe(400);

    const good = await sessionPost(
      jsonReq({ id: crypto.randomUUID(), email: "u@e.st", username: "u" })
    );
    expect(good.status).toBe(200);
    const setCookie = good.headers.get("set-cookie") ?? "";
    expect(setCookie).toContain("interveai_user=");
    expect(setCookie).toContain("HttpOnly");

    const authed = await sessionGet(
      new Request("http://test/api/session", { headers: { cookie: setCookie.split(";")[0] } })
    );
    expect(authed.status).toBe(200);
    expect(((await authed.json()) as { authenticated: boolean }).authenticated).toBe(true);

    const forged = await sessionGet(
      new Request("http://test/api/session", {
        headers: { cookie: `interveai_user=${encodeURIComponent(JSON.stringify({ id: "x" }))}` },
      })
    );
    expect(forged.status).toBe(401);
  });
});
