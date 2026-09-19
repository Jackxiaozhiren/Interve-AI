// Upstream-error classifier (E4 MVVP follow-up; keyless, no ai mock —
/// the real NoObjectGeneratedError brand is exercised).
import { describe, it, expect } from "vitest";
import { NoObjectGeneratedError } from "ai";
import { classifyUpstreamError } from "../../src/lib/api/classify-error";

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
      if (src.includes("classifyUpstreamError(e)")) wired.push(r);
      expect(src, `${r}: bare upstream_error`).not.toContain('reason: "upstream_error"');
    }
    // 14 AI lanes (parse-resume/trends/session keep their distinct reasons).
    expect(wired.length).toBe(14);
  });
});
