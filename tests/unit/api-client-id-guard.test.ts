// Why this exists: when a session could not be persisted, src/app/setup/page.tsx
// substitutes the string id `local-<uuid>`. Four call sites then do
// parseInt/Number on it, get NaN, and hand that to Postgres, which answers
// `invalid input syntax for type bigint: "NaN"` — observed in the live smoke
// lane. A local-only session has no row to read, so the correct answer to
// "get me row NaN" is "no such row", without spending a request on it.
import { describe, it, expect, beforeEach, vi } from "vitest";

const eqCalls: unknown[][] = [];
let nextResult: { data: unknown; error: unknown } = { data: null, error: null };

vi.mock("../../src/lib/supabase", () => ({
  supabase: {
    // Content writes now require an owner (see stampOwner), so this harness has
    // to present a session — otherwise every write is refused before it reaches
    // the builder and the id-guard being tested never gets exercised.
    auth: { getSession: async () => ({ data: { session: { user: { id: "uid-1" } } } }) },
    from: () => ({
      select: () => chained(),
      update: () => chained(),
    }),
  },
}));

// eq() is the terminal filter for both paths: get() then calls .single(),
// update() awaits the builder directly. eq() returns the same object so chained
// filters (the owner predicate plus the id) are all recorded, matching the real
// PostgREST builder.
function chained() {
  const api = {
    eq: (field: string, value: unknown) => {
      eqCalls.push([field, value]);
      return api;
    },
    single: () => Promise.resolve(nextResult),
    then: (res: (v: unknown) => unknown) => Promise.resolve(nextResult).then(res),
  };
  return api;
}

import { dbClient } from "../../src/lib/api-client";

beforeEach(() => {
  eqCalls.length = 0;
  nextResult = { data: null, error: null };
});

describe("interviews.get with a non-persistable id", () => {
  it("returns undefined for a local-only id without querying", async () => {
    await expect(dbClient.interviews.get("local-6f1c2b3a" as never)).resolves.toBeUndefined();
    expect(eqCalls).toEqual([]);
  });

  it("returns undefined for NaN without querying", async () => {
    await expect(dbClient.interviews.get(Number("local-x"))).resolves.toBeUndefined();
    expect(eqCalls).toEqual([]);
  });

  it("returns undefined for the empty string without querying", async () => {
    await expect(dbClient.interviews.get("")).resolves.toBeUndefined();
    expect(eqCalls).toEqual([]);
  });

  // Controls: the guard must not swallow real lookups. Both now carry the owner
  // predicate added on 2026-09-27 (see read-ownership-scope.test.ts), so the
  // recorded filters are user_id first, then id.
  it("still queries a numeric id", async () => {
    nextResult = { data: { id: 42, status: "completed" }, error: null };
    const row = await dbClient.interviews.get(42);
    expect(eqCalls).toEqual([["user_id", "uid-1"], ["id", 42]]);
    expect(row?.status).toBe("completed");
  });

  it("still queries a numeric string id", async () => {
    nextResult = { data: { id: 42, status: "in_progress" }, error: null };
    const row = await dbClient.interviews.get("42");
    expect(eqCalls).toEqual([["user_id", "uid-1"], ["id", "42"]]);
    expect(row?.status).toBe("in_progress");
  });
});

describe("interviews.update with a non-persistable id", () => {
  // A read can answer "no such row"; a write must not pretend it saved. The
  // guard still stops the round-trip so the failure names the id, not Postgres.
  it("refuses locally without sending NaN to Postgres", async () => {
    await expect(
      dbClient.interviews.update(Number("local-x"), { status: "completed" })
    ).rejects.toThrow(/not persistable/i);
    expect(eqCalls).toEqual([]);
  });

  it("still updates a numeric id", async () => {
    await dbClient.interviews.update(42, { status: "completed" });
    expect(eqCalls).toEqual([["id", 42]]);
  });
});
