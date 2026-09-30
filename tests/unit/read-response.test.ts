import { describe, expect, it } from "vitest";
import { describeApiFailure, readApiJson, type ApiFailure } from "@/lib/api/read-response";
import fs from "node:fs";
import path from "node:path";

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

/**
 * The sweep's done-when predicate. Without it, "I migrated the call sites" is a
 * claim about a list I was reading from memory, and lists rot: the original
 * inventory was compiled by grep and every session since has added or removed
 * one. This asserts the property instead of the story.
 *
 * Server routes are out of scope — they read request bodies (`await req.json()`)
 * inside the shared guard, which is the correct place for that.
 */
describe("no client fetch parses JSON by hand", () => {
  // Built fresh per use: a /g regex carries lastIndex, and reusing one across
  // files with .test() skips matches depending on where the last scan stopped.
  const BARE_PARSE = () => /await\s+(?:res|resp|response|r)\.json\s*\(\s*\)/g;

  function clientFiles(dir = path.join(process.cwd(), "src"), out: string[] = []): string[] {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (full.includes(`${path.sep}api${path.sep}`)) continue;
        clientFiles(full, out);
      } else if (/\.(ts|tsx)$/.test(entry.name)) {
        out.push(full);
      }
    }
    return out;
  }

  it("the scan can see the pattern it forbids", () => {
    expect("const d = await res.json();".match(BARE_PARSE())).toHaveLength(1);
    expect("const d = await response.json();".match(BARE_PARSE())).toHaveLength(1);
    expect("const d = await req.json();".match(BARE_PARSE())).toBeNull();
  });

  it("finds bare parses only inside read-response.ts", () => {
    const offenders = clientFiles()
      .filter((f) => !f.endsWith("lib/api/read-response.ts"))
      .filter((f) => BARE_PARSE().test(fs.readFileSync(f, "utf8")))
      .map((f) => path.relative(process.cwd(), f));
    expect(offenders, `hand-rolled JSON parses:\n  ${offenders.join("\n  ")}`).toEqual([]);
  });
});
