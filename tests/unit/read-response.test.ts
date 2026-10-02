import { describe, expect, it } from "vitest";
import { describeApiFailure, readApiJson, type ApiFailure } from "@/lib/api/read-response";
import fs from "node:fs";
import path from "node:path";
import ts from "typescript";

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
  /**
   * Counts hand-rolled response parses from the parse tree.
   *
   * The first version of this was a regex for `await res.json()`, and it declared
   * the sweep complete while two sites still read `.then(res => res.json())` —
   * a promise chain never mentions await. This is the fourth instrument in this
   * repo to fail by scanning text instead of parsing it (after rawFetchCalls,
   * anyEscapes and the protected-attribute lock), so the shape is fixed: parse,
   * and match any zero-argument `.json()` regardless of how the result is
   * consumed.
   */
  function countBareParses(sourceText: string, fileName: string): { line: number; receiver: string }[] {
    const sf = ts.createSourceFile(fileName, sourceText, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    const hits: { line: number; receiver: string }[] = [];
    const visit = (node: ts.Node) => {
      if (
        ts.isCallExpression(node) &&
        ts.isPropertyAccessExpression(node.expression) &&
        node.expression.name.getText(sf) === "json" &&
        node.arguments.length === 0
      ) {
        const { line } = sf.getLineAndCharacterOfPosition(node.getStart(sf));
        hits.push({ line: line + 1, receiver: node.expression.expression.getText(sf) });
      }
      ts.forEachChild(node, visit);
    };
    visit(sf);
    return hits;
  }

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

  it("the scan can see every shape of the pattern it forbids", () => {
    // Without this control the sweep can be green because the predicate is blind,
    // which is precisely what happened to the regex version.
    const shapes = [
      "const d = await res.json();",
      "return fetch(u).then(res => res.json()).then(d => d);",
      "const d = (await response.json()) as T;",
      "fetch(u).then(r => { const d = r.json(); });",
    ];
    for (const src of shapes) {
      expect(countBareParses(src, "probe.ts"), src).toHaveLength(1);
    }
  });

  it("does not count the shared reader or unrelated calls", () => {
    expect(countBareParses("const d = await readApiJson(res);", "probe.ts")).toHaveLength(0);
    expect(countBareParses("return Response.json({ ok: true }, { status: 200 });", "probe.ts")).toHaveLength(0);
    expect(countBareParses("const d = JSON.parse(text);", "probe.ts")).toHaveLength(0);
  });

  it("finds bare parses only inside read-response.ts", () => {
    const offenders = clientFiles()
      .filter((f) => !f.endsWith("lib/api/read-response.ts"))
      .flatMap((f) =>
        countBareParses(fs.readFileSync(f, "utf8"), f).map(
          (h) => `${path.relative(process.cwd(), f)}:${h.line} (${h.receiver}.json())`
        )
      );
    expect(offenders, `hand-rolled JSON parses:\n  ${offenders.join("\n  ")}`).toEqual([]);
  });
});
