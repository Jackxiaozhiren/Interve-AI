// Phase D3: telemetry limit/reverse chain (mocked supabase, zero network).
import { describe, it, expect, vi, beforeEach } from "vitest";

const calls: { order: unknown[]; limit: unknown[]; table: unknown[] } = { order: [], limit: [], table: [] };
let nextResult: { data: unknown[]; error: null } = { data: [], error: null };

vi.mock("../../src/lib/supabase", () => ({
  supabase: {
    from: (table: string) => {
      calls.table.push(table);
      return {
        select: () => ({
          order: (field: string, opts: { ascending: boolean }) => {
            calls.order.push([table, field, opts]);
            const terminal = Promise.resolve(nextResult);
            return Object.assign(terminal, {
              limit: (n: number) => {
                calls.limit.push([table, n]);
                return Promise.resolve(nextResult);
              },
            });
          },
        }),
      };
    },
  },
}));

import { dbClient } from "../../src/lib/api-client";

beforeEach(() => {
  calls.order = [];
  calls.limit = [];
  calls.table = [];
  nextResult = { data: [], error: null };
});

describe("telemetry orderBy/reverse/limit (D3 bounded lists)", () => {
  it("reverse().limit(500) queries newest-first with a cap, mapping keys", async () => {
    nextResult = { data: [{ latency_ms: 12, created_at: "t" }], error: null };
    const rows = await dbClient.telemetry.orderBy("timestamp").reverse().limit(500).toArray();
    expect(calls.order).toEqual([["telemetry", "timestamp", { ascending: false }]]);
    expect(calls.limit).toEqual([["telemetry", 500]]);
    expect(rows).toEqual([{ latencyMs: 12, createdAt: "t" }]);
  });

  it("plain toArray() stays uncapped ascending (backward compatible)", async () => {
    await dbClient.telemetry.orderBy("timestamp").toArray();
    expect(calls.order).toEqual([["telemetry", "timestamp", { ascending: true }]]);
    expect(calls.limit).toEqual([]);
  });

  it("limit() without reverse caps the ascending window", async () => {
    await dbClient.telemetry.orderBy("timestamp").limit(50).toArray();
    expect(calls.limit).toEqual([["telemetry", 50]]);
  });
});
