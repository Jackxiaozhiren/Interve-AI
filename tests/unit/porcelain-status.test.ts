// V11 Ring B follow-up. The dirty-tree attribution added in Phase 0 read
// `git status --porcelain` and assumed field 2 is one path. For a rename git
// emits `XY new -> old` (and wraps long entries with a backslash), so the
// pathspec handed to `git log` was the literal string "a.ts -> b.ts", which
// matches no commit. Every renamed file therefore lost its lastTouch — and a
// ratchet whose dirty entries have no provenance is exactly the thing R-16
// exists to prevent, failing quietly rather than loudly.
//
// -z fixes both: NUL-separated records are never wrapped, and a rename's source
// arrives as its own field instead of being glued with " -> ".
import { describe, it, expect } from "vitest";
import { existsSync } from "node:fs";
import { parseStatusEntries, gitStatusZ } from "../../scripts/audit-facts.mjs";

describe("parseStatusEntries", () => {
  it("reads a plain modification", () => {
    expect(parseStatusEntries(" M docs/a.md\0")).toEqual([
      { status: "M", path: "docs/a.md" },
    ]);
  });

  it("reads a staged rename by its destination, keeping the source", () => {
    // Field order measured against real git on a live rename: the new path
    // comes first, the old path is the following record.
    expect(parseStatusEntries("R  tests/new.ts\0tests/old.ts\0")).toEqual([
      { status: "R", path: "tests/new.ts", renamedFrom: "tests/old.ts" },
    ]);
  });

  it("reads a rename that also has a worktree modification", () => {
    // `RM` — staged rename plus unstaged edit. Provenance must follow the file
    // as it exists now, not the path that disappeared.
    expect(parseStatusEntries("RM b.ts\0a.ts\0")).toEqual([
      { status: "RM", path: "b.ts", renamedFrom: "a.ts" },
    ]);
  });

  it("reads an untracked file", () => {
    expect(parseStatusEntries("?? new.ts\0")).toEqual([
      { status: "??", path: "new.ts" },
    ]);
  });

  it("keeps two records on one line apart", () => {
    const rows = parseStatusEntries(" M a.ts\0?? b.ts\0");
    expect(rows.map((r) => r.path)).toEqual(["a.ts", "b.ts"]);
  });

  it("returns nothing for a clean tree", () => {
    expect(parseStatusEntries("")).toEqual([]);
    expect(parseStatusEntries("\0")).toEqual([]);
  });

  it("does not treat the rename arrow as part of a path", () => {
    // The bug this replaced: the old parser produced this string as a path.
    for (const row of parseStatusEntries("RM b.ts\0a.ts\0")) {
      expect(row.path).not.toContain("->");
    }
  });

  // Second bug in the same code path, and a nastier one: the shared git()
  // helper trims, but a porcelain record begins with a space whenever the index
  // is clean — so the FIRST entry of the run lost its leading character and
  // "docs/RELEASE_CHECKLIST.md" became "ocs/RELEASE_CHECKLIST.md". Nothing
  // downstream noticed, because a bogus pathspec simply returns no commits.
  // Pinned here on a fixture whose first record carries that leading space.
  it("keeps the first record intact when its index column is a space", () => {
    expect(parseStatusEntries(" M docs/RELEASE_CHECKLIST.md\0")).toEqual([
      { status: "M", path: "docs/RELEASE_CHECKLIST.md" },
    ]);
  });

  it("does not trim that leading space off the real status output", () => {
    // The parser is correct above; this pins the other half — that collectGit is
    // handed untrimmed text. Proven on the live tree whenever it is dirty, and
    // by the ratchet test, which is what surfaced this.
    const raw = gitStatusZ();
    if (raw === "") return; // clean tree: nothing to misattribute
    for (const row of parseStatusEntries(raw)) {
      if (!row.status.includes("D")) expect(existsSync(row.path), row.path).toBe(true);
    }
  });
});
