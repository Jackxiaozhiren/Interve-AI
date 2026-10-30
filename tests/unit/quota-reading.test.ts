// The reading R7 asks for: what is left of today's allowance, visible before it
// runs out. These pin the two decisions a careless UI gets wrong — an absent
// header must never become "0 left", and a response that says nothing must not
// erase a reading the user is already looking at.
import { describe, it, expect, beforeEach } from "vitest";
import {
  getQuota,
  parseQuota,
  recordQuota,
  resetQuota,
  subscribeQuota,
} from "../../src/lib/api/quota";
import { readApiJson } from "../../src/lib/api/read-response";
import { applyQuotaHeaders } from "../../src/lib/api/guard";

function withHeaders(pairs: Record<string, string>): Headers {
  const h = new Headers();
  for (const [k, v] of Object.entries(pairs)) h.set(k, v);
  return h;
}

describe("quota reading", () => {
  beforeEach(() => resetQuota());

  it("reads both headers", () => {
    const q = parseQuota(withHeaders({ "RateLimit-Remaining": "137", "RateLimit-Reset": "3600" }));
    expect(q).toEqual({ remaining: 137, resetSeconds: 3600 });
  });

  it("is null when the response says nothing — never zero", () => {
    expect(parseQuota(withHeaders({}))).toBeNull();
  });

  it("is null on a value it cannot trust, rather than guessing", () => {
    expect(parseQuota(withHeaders({ "RateLimit-Remaining": "lots" }))).toBeNull();
    expect(parseQuota(withHeaders({ "RateLimit-Remaining": "-3" }))).toBeNull();
    expect(parseQuota(withHeaders({ "RateLimit-Remaining": "" }))).toBeNull();
  });

  it("treats a missing reset as 'unknown', not as 'now'", () => {
    expect(parseQuota(withHeaders({ "RateLimit-Remaining": "5" }))).toEqual({
      remaining: 5,
      resetSeconds: 0,
    });
  });

  it("notifies subscribers, and leaves the last reading alone when a response is silent", () => {
    const seen: number[] = [];
    const off = subscribeQuota((reading) => seen.push(reading?.remaining ?? -1));

    recordQuota(new Response("{}", { headers: { "RateLimit-Remaining": "42" } }));
    expect(getQuota()?.remaining).toBe(42);

    // A route that opts out of the budget answers without the header. That must
    // not blank the badge the user is currently reading.
    recordQuota(new Response("{}"));
    expect(getQuota()?.remaining).toBe(42);
    expect(seen).toEqual([42]);

    off();
    recordQuota(new Response("{}", { headers: { "RateLimit-Remaining": "41" } }));
    expect(seen).toEqual([42]);
  });

  it("is picked up by the shared reader, so every call site feeds it", async () => {
    const res = new Response(JSON.stringify({ ok: true }), {
      headers: { "content-type": "application/json", "RateLimit-Remaining": "19", "RateLimit-Reset": "90" },
    });
    const result = await readApiJson<{ ok: boolean }>(res);
    expect(result.ok).toBe(true);
    expect(getQuota()).toEqual({ remaining: 19, resetSeconds: 90 });
  });
});

describe("stamping the headers onto a response", () => {
  it("writes both headers from a reading", () => {
    const res = applyQuotaHeaders(new Response("{}"), { remaining: 7, resetMs: 5 * 60_000 });
    expect(res.headers.get("RateLimit-Remaining")).toBe("7");
    expect(res.headers.get("RateLimit-Reset")).toBe("300");
  });

  it("leaves the response alone when the route has no budget", () => {
    const res = applyQuotaHeaders(new Response("{}"), undefined);
    expect(res.headers.get("RateLimit-Remaining")).toBeNull();
    expect(res.headers.get("RateLimit-Reset")).toBeNull();
  });

  it("never writes a negative remainder", () => {
    const res = applyQuotaHeaders(new Response("{}"), { remaining: -4, resetMs: 0 });
    expect(res.headers.get("RateLimit-Remaining")).toBe("0");
  });
});
