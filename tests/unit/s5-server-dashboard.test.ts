// S5 slice 5: the dashboard list is read on the server with the parallel
// session, and degrades to the original browser read only when that session is
// unavailable. A list has no not_found state — an empty account is `ok` with an
// empty array and must render the empty dashboard, never a fallback.
import { describe, it, expect, vi, beforeEach } from "vitest";
import { readFileSync } from "node:fs";

const state: {
  client: unknown;
  user: { id: string } | null;
  getUserError: unknown;
  rows: unknown[];
  throws: boolean;
  calls: unknown[][];
} = {
  client: null,
  user: { id: "uid-owner" },
  getUserError: null,
  rows: [],
  throws: false,
  calls: [],
};

vi.mock("@/lib/supabase/server", () => ({
  createServerSupabase: async () => state.client,
}));

vi.mock("@/lib/db", () => ({
  db: {
    interviews: {
      orderBy: (...args: unknown[]) => {
        state.calls.push(args);
        return {
          reverse: () => ({
            toArray: async () => {
              if (state.throws) throw new Error("database unreachable");
              return state.rows;
            },
          }),
        };
      },
    },
  },
}));

import { readInterviewsOnServer } from "@/lib/supabase/server-reads";

const ROOT = new URL("../../", import.meta.url);
const shell = readFileSync(new URL("src/app/dashboard/page.tsx", ROOT), "utf8");
const island = readFileSync(new URL("src/app/dashboard/client.tsx", ROOT), "utf8");

function fakeClient() {
  return {
    auth: {
      getUser: async () => ({ data: { user: state.user }, error: state.getUserError }),
    },
  };
}

beforeEach(() => {
  state.client = null;
  state.user = { id: "uid-owner" };
  state.getUserError = null;
  state.rows = [];
  state.throws = false;
  state.calls = [];
});

describe("readInterviewsOnServer", () => {
  it("returns unavailable without a parallel session and never reads a list", async () => {
    expect(await readInterviewsOnServer()).toEqual({ status: "unavailable" });
    expect(state.calls).toEqual([]);
  });

  it("passes the injected client and validated uid to the existing chain", async () => {
    const client = fakeClient();
    state.client = client;
    state.rows = [{ id: 1, status: "completed" }];

    expect(await readInterviewsOnServer()).toEqual({
      status: "ok",
      value: [{ id: 1, status: "completed" }],
    });
    // The whole point: the list travels through the cookie-backed client with a
    // validated uid, not the module browser client. Reverting either argument
    // reddens this.
    expect(state.calls).toEqual([["createdAt", client, "uid-owner"]]);
  });

  it("treats an empty account as ok with an empty array, not as a fallback", async () => {
    state.client = fakeClient();
    state.rows = [];
    expect(await readInterviewsOnServer()).toEqual({ status: "ok", value: [] });
  });

  it("treats an unvalidated token or a failed read as unavailable", async () => {
    state.client = fakeClient();
    state.user = null;
    expect(await readInterviewsOnServer()).toEqual({ status: "unavailable" });
    expect(state.calls).toEqual([]);

    state.user = { id: "uid-owner" };
    state.getUserError = new Error("expired");
    expect(await readInterviewsOnServer()).toEqual({ status: "unavailable" });

    state.getUserError = null;
    state.throws = true;
    expect(await readInterviewsOnServer()).toEqual({ status: "unavailable" });
  });
});

describe("dashboard server shell / client island boundary", () => {
  it("keeps the route file a Server Component that hands the list down", () => {
    expect(shell).not.toContain('"use client"');
    expect(shell).not.toContain("'use client'");
    expect(shell).toContain('from "@/lib/supabase/server-reads"');
    expect(shell).toContain("readInterviewsOnServer()");
    expect(shell).toContain("<DashboardClient initial={initial} />");
  });

  it("keeps the island's client boundary and seeds from the server list", () => {
    expect(island).toContain("'use client'");
    expect(island).toContain('import type { ServerListRead } from "@/lib/supabase/server-reads"');
    expect(island).toContain('initial.status === "ok" ? initial.value : []');
    expect(island).toContain('useState(initial.status === "unavailable")');
  });

  it("falls back to the browser read only on unavailable, exactly once", () => {
    expect(island).toContain('if (initial.status !== "unavailable") return;');
    expect((island.match(/db\.interviews\.orderBy\(/g) ?? []).length).toBe(1);
    expect(island).toContain("void loadSessions()");
  });
});
