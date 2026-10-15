/**
 * Counts that an outside system owns must not be restated in checked-in prose.
 *
 * `docs/RELEASE_CHECKLIST.md` carried "38 production deployments since
 * 2026-04-25" inside a sentence that was true when it was typed on 2026-09-26.
 * Publishing is continuous — every push to `main` creates a Production
 * deployment — so the same list read 157 entries nineteen days later. Nothing
 * in the repo could notice, because nothing compared the digit to anything: it
 * was a fact about a day, written in present tense, and the ratchet cannot see
 * a number that no detector measures.
 *
 * The rule is therefore about the shape, not the value: a moving external
 * total, written down, reads as current. Sweep is whitespace-folded because
 * this is prose and the phrase wrapped across lines — a literal-space pattern
 * found zero hits in the corpus it was written to police.
 */
import { describe, expect, it } from "vitest";
import { readRepo, walkRepo } from "./repo-tree";

const DOC_FILES = [...walkRepo("docs", (rel) => rel.endsWith(".md")), "README.md"];

const MOVED_BY_A_PUSH = /\d[\d,]*\s+(?:production\s+)?deployments?\b|\d[\d,]*\s+total\s+since\b/i;

/** Collapse newlines so a sentence wrapped mid-phrase still matches. */
const fold = (text: string) => text.replace(/\s+/g, " ");

describe("docs do not restate a total that publishing keeps moving", () => {
  it("sweeps the whole document corpus, not the file that had the bug", () => {
    expect(DOC_FILES.length).toBeGreaterThanOrEqual(40);
    expect(DOC_FILES).toContain("docs/RELEASE_CHECKLIST.md");
    expect(DOC_FILES).toContain("README.md");
  });

  it("names no deployment count as a fact", () => {
    const hits = DOC_FILES.flatMap((rel) => {
      const body = fold(readRepo(rel));
      const m = MOVED_BY_A_PUSH.exec(body);
      return m ? [`${rel}: "${m[0]}"`] : [];
    });
    expect(hits).toEqual([]);
  });

  it("leaves the reader an authority to read instead of a stale digit", () => {
    // Deleting the number without saying where the number lives would trade a
    // stale fact for no fact. The pointer is part of the fix, so it is pinned.
    const checklist = fold(readRepo("docs/RELEASE_CHECKLIST.md"));
    expect(checklist).toMatch(/Deployments\s+→\s+Production/);
    expect(checklist).toMatch(/every push to `?main`? publishes/);
  });
});
