// S5 slice 5: the dashboard route file is a Server Component and the
// interactive board is its client island. The reader's session handling
// (unavailable without a session, injected client + validated uid, empty
// account is `ok`, failures degrade) is pinned in tests/unit/
// s5-server-replay.test.ts, which shares the same harness for both readers —
// repeating it here would copy the mock plumbing instead of testing it.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

const ROOT = new URL("../../", import.meta.url);
const shell = readFileSync(new URL("src/app/dashboard/page.tsx", ROOT), "utf8");
const island = readFileSync(new URL("src/app/dashboard/client.tsx", ROOT), "utf8");

describe("dashboard server shell", () => {
  it("is a Server Component that reads the list and hands it down", () => {
    expect(shell).not.toContain('"use client"');
    expect(shell).not.toContain("'use client'");
    expect(shell).toContain('from "@/lib/supabase/server-reads"');
    expect(shell).toContain("readInterviewsOnServer()");
    expect(shell).toContain("<DashboardClient initial={initial} />");
  });

  it("reuses the shared reader instead of forking a second read path", () => {
    expect(shell).toContain("readInterviewsOnServer");
    // No direct DB import in the shell: the reader owns validation + RLS.
    expect(shell).not.toContain('from "@/lib/db"');
    expect(shell).not.toContain("supabase.from");
  });
});

describe("dashboard client island", () => {
  it("keeps its client boundary and seeds from the server list", () => {
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
