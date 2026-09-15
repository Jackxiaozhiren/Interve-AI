// Phase 2: HMAC session unit tests (P0-3, P1-2).
import { describe, it, expect, beforeEach } from "vitest";
import {
  signSession,
  verifySessionCookie,
  getSessionSecret,
  parseCookies,
  SESSION_TTL_MS,
} from "../../src/lib/api/session";

const TEST_SECRET = "phase2-test-secret-0123456789abcdef";

beforeEach(() => {
  process.env.SESSION_SECRET = TEST_SECRET;
  delete process.env.NODE_ENV_OVERRIDE;
});

describe("signSession / verifySessionCookie", () => {
  it("round-trips a valid session", async () => {
    const signed = await signSession({ id: "11111111-1111-1111-1111-111111111111", email: "a@b.co", username: "ab" }, TEST_SECRET);
    const payload = await verifySessionCookie(signed, TEST_SECRET);
    expect(payload?.id).toBe("11111111-1111-1111-1111-111111111111");
    expect(payload?.email).toBe("a@b.co");
    expect(payload?.v).toBe(1);
  });

  it("rejects tampered payloads", async () => {
    const signed = await signSession({ id: "x", email: "a@b.co", username: "ab" }, TEST_SECRET);
    const [body] = signed.split(".");
    const evil = `${body}.AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA`;
    expect(await verifySessionCookie(evil, TEST_SECRET)).toBeNull();
  });

  it("rejects legacy unsigned JSON cookies (forces one re-login)", async () => {
    const legacy = encodeURIComponent(JSON.stringify({ id: "x", email: "a@b.co" }));
    expect(await verifySessionCookie(legacy, TEST_SECRET)).toBeNull();
    expect(await verifySessionCookie(undefined, TEST_SECRET)).toBeNull();
    expect(await verifySessionCookie("", TEST_SECRET)).toBeNull();
  });

  it("rejects expired sessions", async () => {
    const signed = await signSession({ id: "x", email: "a@b.co", username: "ab" }, TEST_SECRET, 1000);
    expect(await verifySessionCookie(signed, TEST_SECRET, 1000 + SESSION_TTL_MS + 1)).toBeNull();
  });

  it("rejects wrong-secret signatures", async () => {
    const signed = await signSession({ id: "x", email: "a@b.co", username: "ab" }, TEST_SECRET);
    expect(await verifySessionCookie(signed, "another-secret-0000000000000000")).toBeNull();
  });
});

describe("getSessionSecret", () => {
  it("uses a configured secret of sufficient length", () => {
    expect(getSessionSecret()).toBe(TEST_SECRET);
  });

  it("rejects too-short secrets everywhere", () => {
    process.env.SESSION_SECRET = "short";
    expect(getSessionSecret()).toBeNull();
  });
});

describe("parseCookies", () => {
  it("parses cookie headers", () => {
    expect(parseCookies("a=1; interveai_user=xyz; b=2")["interveai_user"]).toBe("xyz");
    expect(parseCookies(null)).toEqual({});
  });
});
