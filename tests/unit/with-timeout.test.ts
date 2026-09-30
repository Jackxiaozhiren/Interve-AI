import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { withTimeout } from "../../src/lib/with-timeout";

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("withTimeout", () => {
  it("returns the promise's own value when it wins the race", async () => {
    const p = Promise.resolve("settled");
    vi.advanceTimersByTime(0);
    await expect(withTimeout(p, 100, () => "fell back")).resolves.toBe("settled");
  });

  it("returns the caller's fallback when the promise never settles", async () => {
    const pending = new Promise<string>(() => { /* no resolve, no reject — a stalled fetch */ });
    const result = withTimeout(pending, 100, () => "fell back");
    await vi.advanceTimersByTimeAsync(100);
    await expect(result).resolves.toBe("fell back");
  });

  it("propagates a rejection instead of reporting a timeout", async () => {
    // Masking a real auth error as "timed out, proceed unverified" would turn a
    // diagnosable failure into a silent one.
    const boom = Promise.reject(new Error("network"));
    await expect(withTimeout(boom, 100, () => "fell back")).rejects.toThrow("network");
  });

  it("cancels its own timer once the promise settles", async () => {
    await withTimeout(Promise.resolve(1), 10_000, () => 2);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("does not resolve twice when a late value arrives after the fallback", async () => {
    let resolveLate: (v: string) => void = () => {};
    const late = new Promise<string>((res) => { resolveLate = res; });
    const raced = withTimeout(late, 50, () => "fell back");
    await vi.advanceTimersByTimeAsync(50);
    resolveLate("too late");
    await vi.advanceTimersByTimeAsync(0);
    await expect(raced).resolves.toBe("fell back");
  });
});
