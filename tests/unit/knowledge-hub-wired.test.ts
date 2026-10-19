/**
 * The resume search index has a live read path and no production writer.
 *
 * `restoreKnowledgeHub()` runs on the interview page's mount, `queryKnowledgeHub()`
 * feeds per-answer context from it, and the privacy centre tells every signed-in
 * account that a serialized row of theirs is stored for exactly that purpose. But
 * `initializeKnowledgeHub` — the only function that creates a row — was called from
 * three test files and from nothing in `src/`. So the table is empty in production
 * (verified by the owner against the live project), every restore returns false, the
 * one `console.warn` that says so is followed by a query path that throws and is
 * caught by a second generic warn, and the feature the privacy page describes has
 * never once run for a user.
 *
 * The seam chosen is where the read path and the resume text meet — opening a saved
 * interview — rather than the upload, because that single place covers first
 * interviews, resumed sessions and a device switch, and it turns
 * `restoreKnowledgeHub() === false` from a dead end into a branch with a next step.
 */
import { describe, expect, it, vi } from "vitest";
import ts from "typescript";
import { readRepo, walkRepo } from "./repo-tree";

/** Files in `src/` that call `name`, read off the parse tree, comments excluded. */
function productionCallers(name: string, self: string): string[] {
  return walkRepo("src", (rel) => /\.tsx?$/.test(rel) && rel !== self).filter((rel) => {
    const sf = ts.createSourceFile(rel, readRepo(rel), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    let hit = false;
    const visit = (n: ts.Node) => {
      if (ts.isCallExpression(n) && ts.isIdentifier(n.expression) && n.expression.text === name) hit = true;
      ts.forEachChild(n, visit);
    };
    ts.forEachChild(sf, visit);
    return hit;
  });
}

const HUB = "src/lib/orama-client.ts";

describe("the knowledge hub has a writer, not only a reader", () => {
  it("is built by production code, not only by tests", () => {
    const callers = productionCallers("ensureKnowledgeHub", HUB);
    expect(
      callers,
      "nothing in src/ builds the index — the read path alone cannot fill orama_index, and the privacy page promises the row"
    ).not.toEqual([]);
  });

  it("keeps the privacy claim and the writer standing or falling together", () => {
    // A biconditional, so it fails in both directions: adding the claim without a
    // writer, and removing the writer while the claim stays. Either leaves a user
    // reading about a stored artefact that does not exist.
    const privacy = readRepo("src/app/dashboard/privacy/page.tsx");
    const claims = /Resume search index/.test(privacy);
    const writes = productionCallers("ensureKnowledgeHub", HUB).length > 0;
    expect(claims === writes, `privacy page claims an index: ${claims}; production code writes one: ${writes}`).toBe(true);
  });
});

const calls: { put: unknown[] } = { put: [] };
let stored: unknown = null;

vi.mock("../../src/lib/supabase", () => ({
  supabase: {
    auth: { getSession: async () => ({ data: { session: null } }) },
    from: (table: string) => {
      if (table !== "orama_index") throw new Error(`unexpected table ${table}`);
      return {
        select: () => ({
          eq: () => ({
            single: () => Promise.resolve(stored ? { data: stored, error: null } : { data: null, error: { code: "PGRST116" } }),
          }),
        }),
        upsert: (row: unknown) => {
          calls.put.push(row);
          stored = row;
          return Promise.resolve({ error: null });
        },
      };
    },
  },
}));

describe("ensureKnowledgeHub's named outcomes", () => {
  const UID = "11111111-1111-4111-8111-111111111111";
  const RESUME = "Senior engineer with ten years of backend work on falcon reactors and harbor logistics.";

  const fresh = async () => {
    vi.resetModules();
    calls.put = [];
    stored = null;
    const mod = await import("../../src/lib/orama-client");
    mod.resetKnowledgeHub();
    return mod;
  };

  it("reports no-resume without touching storage", async () => {
    const hub = await fresh();
    expect(await hub.ensureKnowledgeHub("")).toBe("no-resume");
    expect(await hub.ensureKnowledgeHub(null), "a null resume must not build an empty index").toBe("no-resume");
    expect(calls.put).toEqual([]);
  });

  it("builds and persists once, then restores instead of rebuilding", async () => {
    // A UUID owner is what a signed-in account supplies; without one, `stampOwner`
    // refuses the write and the honest outcome is `memory-only` — the next case.
    const hub = await fresh();
    expect(await hub.ensureKnowledgeHub(RESUME, UID)).toBe("built");
    expect(calls.put).toHaveLength(1);
    expect((calls.put[0] as { user_id?: string }).user_id, "the row must be owned").toBe(UID);
    hub.resetKnowledgeHub();
    expect(await hub.ensureKnowledgeHub(RESUME), "a second visit must restore the stored row, not re-chunk and re-put it").toBe("restored");
    expect(calls.put, "restore is a read; it must not write").toHaveLength(1);
  });

  it("says memory-only when the row could not be persisted", async () => {
    // The 003 owner policies refuse an anon-key write, and `initializeKnowledgeHub`
    // degrades rather than throwing. "built" would be a lie about the next reload.
    await fresh();
    vi.spyOn(console, "error").mockImplementation(() => {});
    const failing = {
      supabase: {
        auth: { getSession: async () => ({ data: { session: null } }) },
        from: () => ({
          select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: null, error: { code: "PGRST116" } }) }) }),
          upsert: () => Promise.reject(new Error("row-level security")),
        }),
      },
    };
    vi.doMock("../../src/lib/supabase", () => failing);
    vi.resetModules();
    const mod = await import("../../src/lib/orama-client");
    mod.resetKnowledgeHub();
    expect(await mod.ensureKnowledgeHub(RESUME, "not-a-uuid")).toBe("memory-only");
    vi.doUnmock("../../src/lib/supabase");
  });
});
