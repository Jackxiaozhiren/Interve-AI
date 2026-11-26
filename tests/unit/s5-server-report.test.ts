// S5 slice 4: the report route reads its row on the server with the same
// parallel-session bridge replay uses, and degrades to the original browser
// read only when that session is unavailable. These contracts pin the new
// shell/island boundary; readInterviewOnServer's three-state behavior is
// already covered by tests/unit/s5-server-replay.test.ts and is not repeated.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

const ROOT = new URL("../../", import.meta.url);
const shell = readFileSync(new URL("src/app/dashboard/report/[id]/page.tsx", ROOT), "utf8");
const island = readFileSync(new URL("src/app/dashboard/report/[id]/client.tsx", ROOT), "utf8");

describe("report server shell", () => {
  it("is a Server Component that reads the row and hands it down", () => {
    expect(shell, "the shell must not carry a client directive").not.toContain('"use client"');
    expect(shell).toContain('from "@/lib/supabase/server-reads"');
    expect(shell).toContain("readInterviewOnServer(Number(id))");
    expect(shell).toContain("<InterviewReportPage id={id} initial={initial} />");
    expect(shell).toContain("const { id } = await params;");
  });

  it("reuses the shared reader instead of forking a second read path", () => {
    expect(shell).toContain("readInterviewOnServer");
    // No direct DB import in the shell: the reader owns validation + RLS.
    expect(shell).not.toContain('from "@/lib/db"');
    expect(shell).not.toContain("supabase.from");
  });
});

describe("report client island", () => {
  it("keeps its client boundary and drops the now-unused useParams", () => {
    expect(island).toContain('"use client"');
    expect(island).not.toContain("useParams");
    expect(island).toContain('import type { ServerRead } from "@/lib/supabase/server-reads"');
  });

  it("seeds state from the server read", () => {
    expect(island).toContain('initial.status === "ok" ? initial.value : null');
    expect(island).toContain('initial.status === "not_found" ? "Interview not found" : ""');
    expect(island).toContain('useState(initial.status === "unavailable")');
  });

  it("falls back to the browser read only on unavailable, exactly once", () => {
    expect(island).toContain('if (initial.status !== "unavailable" || !id) return;');
    expect((island.match(/db\.interviews\.get\(/g) ?? []).length).toBe(1);
    // A false `not_found` second fetch would re-read a real answer.
    expect(island).toContain('}, [id, initial.status]);');
  });

  it("marks the fire-and-forget read so the reliability gate stays clean", () => {
    expect(island).toContain("void loadInterview()");
  });
});
