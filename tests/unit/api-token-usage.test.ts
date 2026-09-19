// H2.4 token dimension (keyless, pure — no provider, no network).
import { describe, it, expect, vi, afterEach } from "vitest";
import { logApi, logStreamUsage, usageOf } from "../../src/lib/api/logging";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("usageOf (defensive AI SDK usage extraction)", () => {
  it("passes through full usage", () => {
    expect(usageOf({ inputTokens: 120, outputTokens: 45, totalTokens: 165 })).toEqual({
      inputTokens: 120,
      outputTokens: 45,
    });
  });

  it("keeps partial usage (never invents the missing side)", () => {
    expect(usageOf({ inputTokens: 7 })).toEqual({ inputTokens: 7 });
    expect(usageOf({ outputTokens: 3 })).toEqual({ outputTokens: 3 });
  });

  it("yields {} for unshaped input (mock/undefined/null/string)", () => {
    expect(usageOf(undefined)).toEqual({});
    expect(usageOf(null)).toEqual({});
    expect(usageOf("tokens")).toEqual({});
    expect(usageOf(42)).toEqual({});
    expect(usageOf({})).toEqual({});
  });

  it("drops non-finite numbers (NaN/Infinity/strings)", () => {
    expect(usageOf({ inputTokens: NaN, outputTokens: Infinity })).toEqual({});
    expect(usageOf({ inputTokens: "120", outputTokens: "45" })).toEqual({});
  });
});

describe("logStreamUsage (deferred stream token line)", () => {
  const flush = () => new Promise<void>((r) => setTimeout(r, 0));

  it("emits one stream_usage line with tokens when the promise resolves", async () => {
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    logStreamUsage("interview-chat", "r3", "glm-4-flash", Promise.resolve({ inputTokens: 500, outputTokens: 120 }));
    await flush();
    expect(spy).toHaveBeenCalledTimes(1);
    const line = JSON.parse(spy.mock.calls[0][0] as string);
    expect(line.reason).toBe("stream_usage");
    expect(line.inputTokens).toBe(500);
    expect(line.outputTokens).toBe(120);
  });

  it("stays silent on rejection and on non-promises (telemetry never 500s)", async () => {
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    logStreamUsage("interview-chat", "r4", "glm-4-flash", Promise.reject(new Error("client hung up")));
    logStreamUsage("interview-chat", "r5", "glm-4-flash", undefined);
    await flush();
    expect(spy).not.toHaveBeenCalled();
    expect(errSpy).not.toHaveBeenCalled();
  });
});

describe("logApi token serialization", () => {
  it("emits input/output tokens when present", () => {
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    logApi("analyze-star", { requestId: "r1", status: 200, latencyMs: 9, inputTokens: 120, outputTokens: 45 });
    const line = JSON.parse(spy.mock.calls[0][0] as string);
    expect(line.inputTokens).toBe(120);
    expect(line.outputTokens).toBe(45);
    expect(line.route).toBe("analyze-star");
  });

  it("omits token keys when absent (mock/legacy paths stay clean)", () => {
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    logApi("session", { requestId: "r2", status: 200, latencyMs: 1 });
    const line = JSON.parse(spy.mock.calls[0][0] as string);
    expect("inputTokens" in line).toBe(false);
    expect("outputTokens" in line).toBe(false);
  });
});
