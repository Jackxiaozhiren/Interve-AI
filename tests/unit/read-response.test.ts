import { describe, expect, it } from "vitest";
import { describeApiFailure, readApiJson, type ApiFailure } from "@/lib/api/read-response";

function res(status: number, body: string, contentType = "application/json"): Response {
  return new Response(body, { status, headers: { "content-type": contentType } });
}

describe("readApiJson", () => {
  it("returns the parsed body on success", async () => {
    const out = await readApiJson<{ hint: string }>(res(200, JSON.stringify({ hint: "x" })));
    expect(out).toEqual({ ok: true, data: { hint: "x" } });
  });

  it("reports a 200 whose body is not JSON instead of throwing", async () => {
    // This is the shape a platform-level rejection arrives in, and the reason
    // eight call sites all ended up blaming their own feature.
    const out = await readApiJson(res(200, "<html>bad gateway</html>", "text/html"));
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.failure).toMatchObject({ status: 200, malformed: true });
  });

  it("lifts the error envelope off a failed response", async () => {
    const body = JSON.stringify({ error: { code: "RATE_LIMITED", message: "Too many requests. Please retry later." }, requestId: "r1" });
    const out = await readApiJson(res(429, body));
    expect(out.ok).toBe(false);
    if (!out.ok) {
      expect(out.failure).toMatchObject({ status: 429, code: "RATE_LIMITED", malformed: false });
      expect(out.failure.message).toContain("Too many requests");
    }
  });

  it("keeps the status when a failed response also has a non-JSON body", async () => {
    const out = await readApiJson(res(502, ""));
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.failure).toMatchObject({ status: 502, malformed: true, code: undefined });
  });

  it("treats a JSON `null` body as a success with null data, not a parse failure", async () => {
    const out = await readApiJson(res(200, "null"));
    expect(out).toEqual({ ok: true, data: null });
  });
});

describe("describeApiFailure", () => {
  const cases: Array<[string, ApiFailure, RegExp]> = [
    ["status only", { status: 500, malformed: false }, /500/],
    ["with a code", { status: 422, code: "THIN_TRANSCRIPT", malformed: false }, /422.*THIN_TRANSCRIPT/],
    ["with a message", { status: 429, code: "RATE_LIMITED", message: "Too many requests", malformed: false }, /Too many requests/],
    ["malformed body", { status: 200, malformed: true }, /无法解析的响应/],
  ];

  it.each(cases)("renders %s", (_label, failure, expected) => {
    const line = describeApiFailure(failure);
    expect(line).toMatch(expected);
    expect(line.trim().length).toBeGreaterThan(0);
  });

  it("never claims data was kept or that the user's connection is at fault", () => {
    for (const failure of [
      { status: 500, malformed: false },
      { status: 200, malformed: true },
      { status: 429, code: "RATE_LIMITED", message: "Too many requests", malformed: false },
    ] as ApiFailure[]) {
      const line = describeApiFailure(failure);
      expect(line).not.toMatch(/连接|connection|保留|已保存/);
    }
  });
});
