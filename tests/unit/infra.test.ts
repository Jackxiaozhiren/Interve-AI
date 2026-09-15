// Phase 14: api-client converter + fallback helper unit tests.
import { describe, it, expect } from "vitest";
import { toCamelCase, toSnakeCase } from "../../src/lib/api-client";
import { withModelFallback } from "../../src/ai/providers/fallback";
import { MODEL_IDS } from "../../src/ai/providers/registry";

describe("toCamelCase / toSnakeCase", () => {
  it("converts keys recursively, leaves values alone", () => {
    expect(toCamelCase({ hire_verdict: "x", nested_obj: { inner_key: 1 }, arr: [{ a_b: 2 }] })).toEqual({
      hireVerdict: "x",
      nestedObj: { innerKey: 1 },
      arr: [{ aB: 2 }],
    });
    expect(toSnakeCase({ hireVerdict: "x", nestedObj: { innerKey: 1 } })).toEqual({
      hire_verdict: "x",
      nested_obj: { inner_key: 1 },
    });
  });

  it("passes through scalars and nullish", () => {
    expect(toCamelCase(null)).toBeNull();
    expect(toCamelCase(5)).toBe(5);
    expect(toSnakeCase("s")).toBe("s");
    expect(toCamelCase({})).toEqual({});
  });
});

describe("withModelFallback", () => {
  it("returns primary value without fallback on success", async () => {
    const out = await withModelFallback({
      route: "t",
      requestId: "r",
      startTime: performance.now(),
      primaryModel: { id: "p" } as never,
      primaryModelId: "primary-x",
      run: async () => "ok",
    });
    expect(out).toEqual({ value: "ok", modelId: "primary-x", fallback: false });
  });

  it("falls back exactly once to zhipu-flash on primary failure", async () => {
    const seen: string[] = [];
    const out = await withModelFallback({
      route: "t",
      requestId: "r",
      startTime: performance.now(),
      primaryModel: { id: "p" } as never,
      primaryModelId: "primary-x",
      run: async (model) => {
        const id = (model as { modelId?: string }).modelId ?? "flash";
        seen.push(id);
        if (seen.length === 1) throw new Error("boom");
        return `via-${id}`;
      },
    });
    expect(out.fallback).toBe(true);
    expect(out.modelId).toBe(MODEL_IDS.zhipuFlash);
    expect(seen).toHaveLength(2);
  });

  it("propagates fallback failure (caller maps to 500)", async () => {
    await expect(
      withModelFallback({
        route: "t",
        requestId: "r",
        startTime: performance.now(),
        primaryModel: { id: "p" } as never,
        primaryModelId: "primary-x",
        run: async () => {
          throw new Error("down");
        },
      })
    ).rejects.toThrow("down");
  });
});
