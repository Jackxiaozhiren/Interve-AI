// Defense in depth next to the policy layer (migration 006 closes the bridge).
//
// These read wrappers used to send select('*') with no user predicate at all —
// `dashboard/page.tsx:47` -> `api-client.ts` `select('*').order('created_at')`,
// nothing else — so the only thing narrowing a candidate's dashboard to their own
// rows was RLS, while the browser holds the publishable key and runs as Postgres
// role `anon`. The first run of this file was red on every case, which is the
// measurement that the predicates were missing, not a narrative about it.
//
// orama_index is deliberately NOT here: its reads are already namespaced by
// hubIdForUser and its writes carry an explicit user_id, and tests/unit/
// orama-partition.test.ts guards the legacy fallback read that a session check
// would have broken.
import { describe, it, expect, beforeEach, vi } from "vitest";

type Rec = { table: string; filters: [string, unknown][]; head: boolean };
const queries: Rec[] = [];
let sessionUid: string | null = "uid-owner-1";
let rows: unknown[] = [];
let singleRow: unknown = null;

vi.mock("../../src/lib/supabase", () => ({
  supabase: {
    auth: {
      getSession: async () => ({
        data: { session: sessionUid ? { user: { id: sessionUid } } : null },
      }),
    },
    from: (table: string) => ({
      select: (_cols: string, opts?: { head?: boolean }) => chain(table, !!opts?.head),
    }),
  },
}));

// Awaiting the chain is the list terminal; .single() is the row terminal. Both
// record the filters they were given so the assertions can see the predicate.
function chain(table: string, head: boolean): Record<string, unknown> {
  const rec: Rec = { table, filters: [], head };
  const api: Record<string, unknown> = {
    eq: (f: string, v: unknown) => {
      rec.filters.push([f, v]);
      return api;
    },
    order: () => api,
    limit: () => api,
    single: () => {
      queries.push(rec);
      return Promise.resolve({ data: singleRow, error: singleRow ? null : { code: "PGRST116" } });
    },
    then: (res: (v: unknown) => unknown) => {
      queries.push(rec);
      return Promise.resolve({ data: rows, count: rows.length, error: null }).then(res);
    },
  };
  return api;
}

import { dbClient } from "../../src/lib/api-client";

const filtersOf = (table: string) => queries.find((q) => q.table === table)?.filters ?? [];

beforeEach(() => {
  queries.length = 0;
  sessionUid = "uid-owner-1";
  rows = [];
  singleRow = null;
});

describe("content reads carry the owner predicate", () => {
  it("interviews list filters by user_id", async () => {
    await dbClient.interviews.orderBy("createdAt").reverse().toArray();
    expect(filtersOf("interviews")).toContainEqual(["user_id", "uid-owner-1"]);
  });

  it("interviews.get filters by user_id as well as id", async () => {
    singleRow = { id: 7, status: "completed" };
    const row = await dbClient.interviews.get(7);
    expect(filtersOf("interviews")).toEqual([["user_id", "uid-owner-1"], ["id", 7]]);
    expect(row?.status).toBe("completed");
  });

  it("interviews count filters by user_id", async () => {
    await dbClient.interviews.where("status").equals("completed").count();
    expect(filtersOf("interviews")).toContainEqual(["user_id", "uid-owner-1"]);
  });

  it("interviews sortBy filters by user_id", async () => {
    await dbClient.interviews.where("status").equals("completed").sortBy("createdAt");
    expect(filtersOf("interviews")).toContainEqual(["user_id", "uid-owner-1"]);
  });

  it("practice sessions list filters by user_id", async () => {
    await dbClient.practiceSessions.toArray();
    expect(filtersOf("practice_sessions")).toContainEqual(["user_id", "uid-owner-1"]);
  });

  it("evaluation lookup keeps its own filter and adds user_id", async () => {
    singleRow = { id: 3, candidate_id: "c1" };
    await dbClient.evaluations.where("candidate_id").equals("c1").first();
    expect(filtersOf("evaluations")).toEqual([["user_id", "uid-owner-1"], ["candidate_id", "c1"]]);
  });

  // With no account there is nothing to scope to, so the client declines the
  // query instead of asking anon for a set it can only hope the policy narrows.
  it("returns empty and issues no query when there is no session", async () => {
    sessionUid = null;
    await expect(dbClient.interviews.orderBy("createdAt").reverse().toArray()).resolves.toEqual([]);
    await expect(dbClient.interviews.where("status").equals("completed").count()).resolves.toBe(0);
    await expect(dbClient.practiceSessions.toArray()).resolves.toEqual([]);
    await expect(dbClient.evaluations.where("candidate_id").equals("c1").first()).resolves.toBeUndefined();
    expect(queries).toEqual([]);
  });

  // Control: the predicate must not collapse into "always return nothing".
  it("still returns rows when a session exists", async () => {
    rows = [{ id: 1, status: "completed", created_at: "t" }];
    const list = await dbClient.interviews.orderBy("createdAt").reverse().toArray();
    expect(list).toHaveLength(1);
    expect(list[0].status).toBe("completed");
  });
});
