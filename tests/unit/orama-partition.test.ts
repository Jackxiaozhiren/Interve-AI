// Phase B4-fix: orama_index user partitioning (mocked supabase, zero network).
//
// Regression: the B4 static test missed `db.oramaIndex` behind the `./db`
// alias and wrongly claimed the table unwired. In fact orama-client persists
// resume chunks under ONE global id, anon-readable. These tests pin the fix:
// per-user namespaced ids + user_id stamp + legacy-read fallback.
import { describe, it, expect, vi, beforeEach } from "vitest";

const calls: { get: unknown[]; put: unknown[] } = { get: [], put: [] };
let getQueue: { data: unknown }[] = [];

vi.mock("../../src/lib/supabase", () => ({
  supabase: {
    from: (table: string) => {
      if (table !== "orama_index") throw new Error(`unexpected table ${table}`);
      return {
        select: () => ({
          eq: (field: string, value: unknown) => {
            calls.get.push([field, value]);
            const next = getQueue.shift() ?? { data: null };
            return { single: () => Promise.resolve({ data: next.data, error: next.data ? null : { code: "PGRST116" } }) };
          },
        }),
        upsert: (row: unknown) => {
          calls.put.push(row);
          return Promise.resolve({ error: null });
        },
      };
    },
  },
}));

import { hubIdForUser, initializeKnowledgeHub, restoreKnowledgeHub } from "../../src/lib/orama-client";

const UID = "11111111-1111-4111-8111-111111111111";

beforeEach(() => {
  calls.get = [];
  calls.put = [];
  getQueue = [];
});

describe("hubIdForUser", () => {
  it("namespaces per user, legacy id when unknown", () => {
    expect(hubIdForUser(UID)).toBe(`resume-index:${UID}`);
    expect(hubIdForUser(null)).toBe("resume-index");
  });
});

describe("partitioned persistence", () => {
  it("put stamps user_id and the namespaced id for UUID users", async () => {
    await initializeKnowledgeHub("Senior engineer with ten years of backend work.", UID);
    expect(calls.put).toHaveLength(1);
    const row = calls.put[0] as Record<string, unknown>;
    expect(row.id).toBe(`resume-index:${UID}`);
    expect(row.user_id).toBe(UID); // leaves the anon NULL bridge
  });

  it("put without a user keeps the legacy shape (no stamp possible)", async () => {
    await initializeKnowledgeHub("Some resume text here.", null);
    const row = calls.put[0] as Record<string, unknown>;
    expect(row.id).toBe("resume-index");
    expect(row).not.toHaveProperty("user_id");
  });

  it("restore tries the namespaced id first, then the legacy fallback", async () => {
    getQueue = [{ data: null }, { data: null }];
    await expect(restoreKnowledgeHub(UID)).resolves.toBe(false);
    expect(calls.get).toEqual([
      ["id", `resume-index:${UID}`],
      ["id", "resume-index"],
    ]);
  });
});
