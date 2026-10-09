// Upstream-error classifier (E4 MVVP follow-up; keyless, no ai mock —
/// the real NoObjectGeneratedError brand is exercised).
import { describe, it, expect } from "vitest";
import { NoObjectGeneratedError } from "ai";
import { ZodError } from "zod";
import { classifyUpstreamError } from "../../src/lib/api/classify-error";

// Whether a route actually calls the classifier. Keyed on the call, not on the
// spelling of its argument: `interview-chat` now passes `primaryError` on the
// fallback line, and a predicate written as the literal `classifyUpstreamError(e)`
// would silently stop counting a route that is wired. The scan strips comments
// first, so prose about the classifier is not a call site — including the
// sentence above.
const stripComments = (src: string) =>
  src.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/^\s*\/\/.*$/gm, " ");
const callsClassifier = (source: string) =>
  /classifyUpstreamError\s*\(\s*[A-Za-z_$][\w$]*\s*\)/.test(stripComments(source));

describe("classifyUpstreamError (PII-free reason tokens)", () => {
  it("identifies real NoObjectGeneratedError instances", () => {
    const err = new NoObjectGeneratedError({
      cause: new Error("validation failed"),
      text: "some raw text that must never reach logs",
      response: { id: "r1", modelId: "glm-4-flash" } as never,
      usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 } as never,
      finishReason: "stop" as never,
    });
    expect(NoObjectGeneratedError.isInstance(err)).toBe(true);
    expect(classifyUpstreamError(err)).toBe("no_object_generated");
  });

  it("separates an unreadable answer from an answer that fails the schema", () => {
    // Both used to reach a route-level token only (`output_coerced`,
    // `json_coerced`), which could not tell a prompt bug from a model
    // regression. The distinction is the whole point of naming the cause.
    const unparseable = new SyntaxError(`Unexpected token 'X', "X" is not valid JSON`);
    expect(classifyUpstreamError(unparseable)).toBe("output_unparseable");
    expect(classifyUpstreamError(unparseable)).not.toMatch(/Unexpected|token/);

    const schema = new ZodError([
      { code: "invalid_type", path: ["trends"], message: "Expected array, received string" },
    ] as never);
    expect(classifyUpstreamError(schema)).toBe("output_schema");
  });

  it("maps provider throws to status tokens, never error text", () => {
    expect(classifyUpstreamError(Object.assign(new Error("x"), { statusCode: 429 }))).toBe("upstream_429");
    expect(classifyUpstreamError(Object.assign(new Error("x"), { statusCode: 500 }))).toBe("upstream_500");
    expect(classifyUpstreamError(Object.assign(new Error("aborted"), { name: "AbortError" }))).toBe("upstream_timeout");
    expect(classifyUpstreamError(new Error("weird"))).toBe("upstream_error");
    expect(classifyUpstreamError(null)).toBe("upstream_error");
    expect(classifyUpstreamError(undefined)).toBe("upstream_error");
  });

  it("every route that can fail upstream names how it failed", async () => {
    const { readFileSync, readdirSync } = await import("node:fs");
    const { join } = await import("node:path");
    const { fileURLToPath } = await import("node:url");
    const apiDir = fileURLToPath(new URL("../../src/app/api/", import.meta.url));
    const generators: string[] = [];
    const unwired: string[] = [];
    for (const r of readdirSync(apiDir)) {
      let src: string;
      try {
        src = readFileSync(join(apiDir, r, "route.ts"), "utf8");
      } catch {
        continue;
      }
      // The inventory is derived from what the route calls, so adding an AI lane
      // cannot slip past this check the way a typed count would: 14 was already
      // stale the day it was written, and 16 is what the tree holds today.
      if (/\b(generateText|streamText|generateObject)\s*\(/.test(src)) {
        generators.push(r);
        if (!callsClassifier(src)) unwired.push(r);
      }
      expect(src, `${r}: bare upstream_error`).not.toContain('reason: "upstream_error"');
    }
    expect(generators.length, "no AI route found at all").toBeGreaterThan(0);
    expect(unwired, "these routes call a model and never classify the failure").toEqual([]);
  });

  it("counts the call whatever the argument is called, and never a mention", () => {
    // The predicate above is only honest if it discriminates both ways: a route
    // wired with a differently-named argument still counts, and prose about the
    // classifier does not. Samples assembled from pieces, so the file that owns
    // this rule cannot satisfy its own scan.
    const name = "classify" + "UpstreamError";
    expect(callsClassifier(`logApi(R, { reason: ${name}(e) })`)).toBe(true);
    expect(callsClassifier(`logApi(R, { reason: ${name}(primaryError) })`)).toBe(true);
    expect(callsClassifier(`// TODO: use ${name}(e) here`)).toBe(false);
    expect(callsClassifier(`/* see ${name}(e) */`)).toBe(false);
    expect(callsClassifier(`// ${name}(e)`)).toBe(false);
  });
});
