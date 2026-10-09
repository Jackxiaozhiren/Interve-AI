// Upstream-error classifier (E4 MVVP follow-up; keyless, no ai mock —
/// the real NoObjectGeneratedError brand is exercised).
import { describe, it, expect } from "vitest";
import { NoObjectGeneratedError } from "ai";
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

  it("maps provider throws to status tokens, never error text", () => {
    expect(classifyUpstreamError(Object.assign(new Error("x"), { statusCode: 429 }))).toBe("upstream_429");
    expect(classifyUpstreamError(Object.assign(new Error("x"), { statusCode: 500 }))).toBe("upstream_500");
    expect(classifyUpstreamError(Object.assign(new Error("aborted"), { name: "AbortError" }))).toBe("upstream_timeout");
    expect(classifyUpstreamError(new Error("weird"))).toBe("upstream_error");
    expect(classifyUpstreamError(null)).toBe("upstream_error");
    expect(classifyUpstreamError(undefined)).toBe("upstream_error");
  });

  it("all 14 AI routes wire it (static pin against bare upstream_error)", async () => {
    const { readFileSync, readdirSync } = await import("node:fs");
    const { join } = await import("node:path");
    const { fileURLToPath } = await import("node:url");
    const apiDir = fileURLToPath(new URL("../../src/app/api/", import.meta.url));
    const wired: string[] = [];
    for (const r of readdirSync(apiDir)) {
      let src: string;
      try {
        src = readFileSync(join(apiDir, r, "route.ts"), "utf8");
      } catch {
        continue;
      }
      if (callsClassifier(src)) wired.push(r);
      expect(src, `${r}: bare upstream_error`).not.toContain('reason: "upstream_error"');
    }
    // 14 AI lanes (parse-resume/trends/session keep their distinct reasons).
    expect(wired.length).toBe(14);
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
