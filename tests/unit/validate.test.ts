// Phase 2: body validation + request-id unit tests (P0-3).
import { describe, it, expect } from "vitest";
import { z } from "zod";
import { readJsonBody } from "../../src/lib/api/validate";
import { getRequestId } from "../../src/lib/api/request-id";

const Schema = z.object({ name: z.string().min(1).max(8) });

function jsonReq(body: string, headers: Record<string, string> = {}): Request {
  return new Request("http://x/api/t", {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body,
  });
}

describe("readJsonBody", () => {
  it("accepts valid bodies", async () => {
    const r = await readJsonBody(jsonReq(JSON.stringify({ name: "ada" })), Schema, 1024);
    expect(r.ok).toBe(true);
  });

  it("rejects invalid JSON", async () => {
    const r = await readJsonBody(jsonReq("{nope"), Schema, 1024);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe("INVALID_JSON");
  });

  it("rejects schema violations without echoing the body", async () => {
    const r = await readJsonBody(jsonReq(JSON.stringify({ name: "way-too-long-name" })), Schema, 1024);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error.code).toBe("VALIDATION_FAILED");
      expect(r.error.message).not.toContain("way-too-long-name");
    }
  });

  it("rejects oversized bodies via content-length fast path", async () => {
    const r = await readJsonBody(jsonReq(JSON.stringify({ name: "ada" }), { "content-length": "99999" }), Schema, 16);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe("PAYLOAD_TOO_LARGE");
  });

  it("rejects oversized actual bodies", async () => {
    const big = JSON.stringify({ name: "ada", pad: "x".repeat(5000) });
    const r = await readJsonBody(jsonReq(big), z.object({ name: z.string(), pad: z.string() }), 64);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe("PAYLOAD_TOO_LARGE");
  });
});

describe("getRequestId", () => {
  it("passes through safe client IDs and mints otherwise", () => {
    const ok = new Request("http://x/", { headers: { "x-request-id": "abc-123_X" } });
    expect(getRequestId(ok)).toBe("abc-123_X");
    // Header values with control chars cannot be constructed via Request
    // (undici rejects them), so exercise the sanitizer via a stub.
    const evil = { headers: { get: () => "a\nb" } } as unknown as Request;
    expect(getRequestId(evil)).not.toBe("a\nb");
    expect(getRequestId(new Request("http://x/"))).toMatch(/^[0-9a-f-]{36}$/);
  });
});
