// S5 slice 2: the replay route reads its row on the server with the parallel
// SSR cookie session, and degrades to the old browser read when that session
// is unavailable. These contracts pin both halves — a bridge that silently
// falls back on every request would prove nothing about server reads.
import { describe, it, expect, vi, beforeEach } from "vitest";
import { readFileSync } from "node:fs";

const state: {
  client: unknown;
  user: { id: string } | null;
  getUserError: unknown;
  row: unknown;
  throws: boolean;
  calls: unknown[][];
} = {
  client: null,
  user: { id: "uid-owner" },
  getUserError: null,
  row: undefined,
  throws: false,
  calls: [],
};

vi.mock("@/lib/supabase/server", () => ({
  createServerSupabase: async () => state.client,
}));

vi.mock("@/lib/db", () => ({
  db: {
    interviews: {
      get: async (...args: unknown[]) => {
        state.calls.push(args);
        if (state.throws) throw new Error("database unreachable");
        return state.row;
      },
    },
  },
}));

import { readInterviewOnServer } from "@/lib/supabase/server-reads";

const ROOT = new URL("../../", import.meta.url);
const shell = readFileSync(new URL("src/app/dashboard/replay/[id]/page.tsx", ROOT), "utf8");
const island = readFileSync(new URL("src/app/dashboard/replay/[id]/client.tsx", ROOT), "utf8");

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
  state.row = undefined;
  state.throws = false;
  state.calls = [];
});

describe("readInterviewOnServer", () => {
  it("returns unavailable without a parallel session and never reads a row", async () => {
    expect(await readInterviewOnServer(42)).toEqual({ status: "unavailable" });
    expect(state.calls).toEqual([]);
  });

  it("passes the injected client and validated uid to the existing reader", async () => {
    const client = fakeClient();
    state.client = client;
    state.row = { id: 42, status: "completed" };

    expect(await readInterviewOnServer(42)).toEqual({
      status: "ok",
      value: { id: 42, status: "completed" },
    });
    // This is the whole point of the slice: the read travels through the
    // cookie-backed client with a validated uid, not the module-level browser
    // client. Reverting either argument reddens this test.
    expect(state.calls).toEqual([[42, client, "uid-owner"]]);
  });

  it("treats an unvalidated token as unavailable, not as a not-found row", async () => {
    state.client = fakeClient();
    state.user = null;
    expect(await readInterviewOnServer(42)).toEqual({ status: "unavailable" });
    expect(state.calls).toEqual([]);

    state.user = { id: "uid-owner" };
    state.getUserError = new Error("expired");
    expect(await readInterviewOnServer(42)).toEqual({ status: "unavailable" });
    expect(state.calls).toEqual([]);
  });

  it("distinguishes a real not-found from a failed read", async () => {
    state.client = fakeClient();
    expect(await readInterviewOnServer(42)).toEqual({ status: "not_found" });

    state.throws = true;
    expect(await readInterviewOnServer(42)).toEqual({ status: "unavailable" });
  });
});

describe("replay server shell / client island boundary", () => {
  it("keeps the route file a Server Component that hands the read down", () => {
    expect(shell).not.toContain('"use client"');
    expect(shell).toContain('from "@/lib/supabase/server-reads"');
    expect(shell).toContain("readInterviewOnServer(Number(id))");
    expect(shell).toContain("<ReplayClient id={id} initial={initial} />");
    // Next 15 params are a Promise; awaiting before the read is required.
    expect(shell).toContain("const { id } = await params;");
  });

  it("keeps React hooks out of the module the server reader imports", () => {
    const apiClient = readFileSync(new URL("src/lib/api-client.ts", ROOT), "utf8");
    const hook = readFileSync(new URL("src/lib/use-live-query.ts", ROOT), "utf8");
    expect(apiClient, "a hook in api-client.ts breaks every RSC importer").not.toMatch(
      /from ['"]react['"]|useState|useEffect/
    );
    expect(apiClient).not.toContain("useLiveQuery");
    expect(hook).toContain("export function useLiveQuery");
    // The hook module has no directive on purpose: both importers are already
    // client components. Adding "use client" would grow the ratchet for no gain.
    expect(hook).not.toContain('"use client"');
  });

  it("seeds island state from the server read and only fetches on unavailable", () => {
    expect(island).toContain('"use client"');
    expect(island).toContain('initial.status === "ok" ? initial.value : null');
    expect(island).toContain('initial.status === "unavailable"');
    // Exactly one read site: no duplicate fetch racing the server result.
    expect((island.match(/db\.interviews\.get\(/g) ?? []).length).toBe(1);
  });
});
