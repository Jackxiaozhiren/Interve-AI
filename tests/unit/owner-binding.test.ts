// B1-1 RED: owner-id binding on Supabase writes (GREEN wires the helper).
// Demo logins have no Supabase JWT → rows stay NULL-bridged (unchanged).
// OAuth logins carry a session → user_id = auth.uid() (owner rows).
import { describe, it, expect, vi, beforeEach } from "vitest";

const seen: { table: string; row: Record<string, unknown> }[] = [];
let sessionUid: string | null = "oauth-uid-1";

vi.mock("../../src/lib/supabase", () => ({
  supabase: {
    auth: {
      getSession: async () => ({
        data: { session: sessionUid ? { user: { id: sessionUid } } : null },
      }),
    },
    from: (table: string) => ({
      insert: (row: Record<string, unknown>) => {
        seen.push({ table, row });
        return {
          select: () => ({ single: () => Promise.resolve({ data: { id: 1 }, error: null }) }),
        };
      },
      upsert: (row: Record<string, unknown>) => {
        seen.push({ table, row });
        return Promise.resolve({ error: null });
      },
    }),
  },
}));

import { dbClient } from "../../src/lib/api-client";

beforeEach(() => {
  seen.length = 0;
  sessionUid = "oauth-uid-1";
});

describe("owner-id binding (B1 cutover prep)", () => {
  it("stamps user_id = auth.uid() on interviews.add when a session exists", async () => {
    await dbClient.interviews.add({ title: "t" } as never);
    expect(seen).toHaveLength(1);
    expect(seen[0].table).toBe("interviews");
    expect(seen[0].row["user_id"]).toBe("oauth-uid-1");
  });

  it("stamps user_id on telemetry.add and orama_index.put", async () => {
    await dbClient.telemetry.add({ kind: "k" } as never);
    await dbClient.oramaIndex.put({ id: "h", data: {} } as never);
    expect(seen[0].row["user_id"]).toBe("oauth-uid-1");
    expect(seen[1].row["user_id"]).toBe("oauth-uid-1");
  });

  it("leaves rows NULL-bridged (no user_id) for demo logins without a session", async () => {
    sessionUid = null;
    await dbClient.interviews.add({ title: "t" } as never);
    await dbClient.assessments.add({ title: "a" } as never);
    expect(seen).toHaveLength(2);
    expect("user_id" in seen[0].row).toBe(false);
    expect("user_id" in seen[1].row).toBe(false);
  });

  it("never overwrites a caller-bound user_id (orama memory path)", async () => {
    await dbClient.oramaIndex.put({ id: "h", data: {}, user_id: "pre-bound" } as never);
    expect(seen[0].row["user_id"]).toBe("pre-bound");
  });
});
