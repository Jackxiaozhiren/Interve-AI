/**
 * "30 天自动过期" is a promise about data the candidate never comes back for.
 *
 * `loadSession()` deletes an expired snapshot, but only for the exact
 * `interve_session_<id>` key it is asked to read — and reaching that code again
 * means opening `/interview?id=<that id>`, which requires the link to a specific
 * finished interview. Nobody has it. So an abandoned session's transcript sat in
 * localStorage indefinitely while both `/privacy` and the dashboard's data
 * inventory say snapshots auto-expire after 30 days. The existing privacy guard
 * checked the *number* (`SESSION_TTL_MS = 30 * 24 * 3600 * 1000`) and never the
 * mechanism, which is how the claim stayed green.
 *
 * `pruneExpiredSessions` enumerates keys. It has to be called by something every
 * page mounts, so the second half of this file pins the wiring, not just the
 * function.
 */
import { describe, expect, it } from "vitest";
import {
  SESSION_TTL_MS,
  pruneExpiredSessions,
  sessionKey,
  type IndexedSessionStorage,
} from "@/lib/interview/session-persistence";
import { readFileSync } from "node:fs";

const DAY = 86_400_000;
const NOW = 1_800_000_000_000;

function fakeStore(entries: Record<string, string>): IndexedSessionStorage {
  const map = new Map(Object.entries(entries));
  return {
    get length() {
      return map.size;
    },
    key(index: number) {
      return [...map.keys()][index] ?? null;
    },
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => void map.set(k, v),
    removeItem: (k) => void map.delete(k),
  };
}

const snap = (savedAt: number) => JSON.stringify({ messages: [{ role: "user" }], wpm: 12, fillerWordsCount: 1, savedAt });

describe("pruneExpiredSessions", () => {
  it("removes a 31-day-old snapshot for an interview nobody will reopen", () => {
    const store = fakeStore({ [sessionKey("abandoned")]: snap(NOW - 31 * DAY) });
    const { removed } = pruneExpiredSessions(store, NOW);
    expect(removed).toBe(1);
    expect(store.getItem(sessionKey("abandoned"))).toBeNull();
  });

  it("keeps a 29-day-old snapshot and one exactly at the TTL boundary", () => {
    // loadSession's rule is `now - savedAt > TTL`, so the boundary itself is kept.
    const store = fakeStore({
      [sessionKey("fresh")]: snap(NOW - 29 * DAY),
      [sessionKey("boundary")]: snap(NOW - SESSION_TTL_MS),
    });
    expect(pruneExpiredSessions(store, NOW).removed).toBe(0);
    expect(store.getItem(sessionKey("fresh"))).not.toBeNull();
    expect(store.getItem(sessionKey("boundary"))).not.toBeNull();
  });

  it("never touches another prefix, even when its payload looks expired", () => {
    const store = fakeStore({
      interve_scratchpad_logs: snap(NOW - 400 * DAY),
      interve_system_design_board: snap(NOW - 400 * DAY),
      some_other_app_key: snap(NOW - 400 * DAY),
      [sessionKey("mine")]: snap(NOW - 400 * DAY),
    });
    const { removed, scanned } = pruneExpiredSessions(store, NOW);
    expect(removed).toBe(1);
    // Non-vacuity for the prefix filter: four keys exist, one is ours.
    expect(scanned).toBe(1);
    expect(store.getItem("interve_scratchpad_logs")).not.toBeNull();
    expect(store.getItem("interve_system_design_board")).not.toBeNull();
    expect(store.getItem("some_other_app_key")).not.toBeNull();
  });

  it("drops snapshots it cannot interpret, because they can never age out", () => {
    const store = fakeStore({
      [sessionKey("corrupt")]: "{not json",
      [sessionKey("no-stamp")]: JSON.stringify({ messages: [] }),
    });
    const { removed } = pruneExpiredSessions(store, NOW);
    expect(removed).toBe(2);
  });

  it("scans every session key when removals shift the index", () => {
    // Deleting while walking forward skips the element that slid into the freed
    // index; three adjacent expired keys is the smallest case that shows it.
    const store = fakeStore({
      [sessionKey("a")]: snap(NOW - 60 * DAY),
      [sessionKey("b")]: snap(NOW - 60 * DAY),
      [sessionKey("c")]: snap(NOW - 60 * DAY),
    });
    expect(pruneExpiredSessions(store, NOW).removed).toBe(3);
    expect(store.length).toBe(0);
  });

  it("survives a storage that throws on read (private mode)", () => {
    const hostile: IndexedSessionStorage = {
      length: 1,
      key: () => sessionKey("x"),
      getItem: () => {
        throw new Error("SecurityError");
      },
      setItem: () => {},
      removeItem: () => {},
    };
    expect(() => pruneExpiredSessions(hostile, NOW)).not.toThrow();
    expect(pruneExpiredSessions(hostile, NOW).removed).toBe(0);
  });
});

describe("the sweep is actually wired", () => {
  const read = (rel: string) => readFileSync(new URL(`../../${rel}`, import.meta.url), "utf8");

  it("runs from the component every page mounts", () => {
    // A function nobody calls is a claim, not a control.
    expect(read("src/app/layout.tsx")).toMatch(/<Providers>/);
    const providers = read("src/components/providers.tsx");
    expect(providers).toMatch(/pruneExpiredSessions\s*\(/);
  });

  it("is called at mount rather than only on some later user action", () => {
    const providers = read("src/components/providers.tsx");
    const effect = /useEffect\(\(\s*\)\s*=>\s*\{[\s\S]*?\},\s*\[\]\)/.exec(providers);
    expect(effect, "no mount-only effect in Providers").not.toBeNull();
    expect(effect?.[0]).toMatch(/pruneExpiredSessions/);
  });

  it("names the mechanism in the privacy page's own technical basis", () => {
    // The page ends with 「如果哪天代码与本页不一致，以代码为准」, so its Evidence
    // lines are where a reader is pointed to check. An evidence line that names
    // only the constant is what let this promise stay green while nothing swept.
    const privacy = read("src/app/privacy/page.tsx");
    const evidence = /快照过期由[\s\S]{0,400}?24 小时常量/.exec(privacy);
    expect(evidence, "the expiry Evidence sentence is gone").not.toBeNull();
    expect(evidence?.[0]).toContain("pruneExpiredSessions");
    expect(evidence?.[0]).toContain("loadSession");
    // The named symbols must be real, not prose.
    expect(read("src/lib/interview/session-persistence.ts")).toContain(
      "export function pruneExpiredSessions"
    );
  });

  it("keeps the dashboard's retention row honest about the same mechanism", () => {
    const dash = read("src/app/dashboard/privacy/page.tsx");
    expect(dash).toMatch(/Auto-expires after 30 days/);
    expect(read("src/lib/interview/session-persistence.ts")).toMatch(
      /SESSION_TTL_MS = 30 \* 24 \* 3600 \* 1000/
    );
  });

  it("uses the same TTL constant the expiry promise quotes", () => {
    expect(read("src/lib/interview/session-persistence.ts")).toMatch(
      /now - entry\.savedAt > SESSION_TTL_MS|nowMs - .*savedAt > SESSION_TTL_MS/
    );
  });
});
