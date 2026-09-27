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
import { classifyDbFailure } from "../../src/lib/db";

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

  it("leaves telemetry NULL-bridged (no user_id) for demo logins without a session", async () => {
    sessionUid = null;
    await dbClient.telemetry.add({ kind: "k" } as never);
    expect(seen).toHaveLength(1);
    expect("user_id" in seen[0].row).toBe(false);
  });

  // Rule changed 2026-09-27 (was: content rows also wrote NULL-bridged, which
  // 003's "Legacy anon select unowned" then exposed to every holder of the
  // publishable key). Decision: OAuth is the primary identity path, so an
  // ownerless write to a user-content table is a bug, not a fallback — refuse
  // it and let each call site's existing catch degrade to local-only.
  it("refuses content-table writes when no Supabase session exists", async () => {
    sessionUid = null;
    for (const w of [
      () => dbClient.interviews.add({ title: "t" } as never),
      () => dbClient.evaluations.add({ candidate: "c" } as never),
      () => dbClient.practiceSessions.add({ questionId: "q" } as never),
      () => dbClient.assessments.add({ title: "a" } as never),
      () => dbClient.oramaIndex.put({ id: "h", data: {} } as never),
    ]) {
      await expect(w()).rejects.toThrow(/no supabase (auth )?session/i);
    }
    // Refused, not silently written: nothing reached the client.
    expect(seen).toHaveLength(0);
  });

  // The refusal carries the code classifyDbFailure maps to "unowned_write", so
  // the UI can say what actually happened instead of claiming an outage.
  it("tags the refusal with NO_OWNER so callers can classify it", async () => {
    sessionUid = null;
    const err = await dbClient.interviews.add({ title: "t" } as never).catch((e) => e);
    expect(err).toBeInstanceOf(Error);
    expect((err as Error & { code?: string }).code).toBe("NO_OWNER");
    expect(classifyDbFailure(err)).toBe("unowned_write");
  });

  it("still writes content rows when a session exists (OAuth path)", async () => {
    await dbClient.interviews.add({ title: "t" } as never);
    expect(seen[0].row["user_id"]).toBe("oauth-uid-1");
  });

  it("an explicitly caller-bound row is never rewritten or refused", async () => {
    sessionUid = null;
    await expect(
      dbClient.interviews.add({ title: "t", user_id: "pre-bound" } as never)
    ).resolves.toBeDefined();
    expect(seen[0].row["user_id"]).toBe("pre-bound");
  });

  it("never overwrites a caller-bound user_id (orama memory path)", async () => {
    await dbClient.oramaIndex.put({ id: "h", data: {}, user_id: "pre-bound" } as never);
    expect(seen[0].row["user_id"]).toBe("pre-bound");
  });
});
