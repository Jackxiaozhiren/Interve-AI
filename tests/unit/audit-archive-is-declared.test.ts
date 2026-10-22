/**
 * `docs/audit/archive/` sits outside the prose ceiling, so it needs its own owner.
 *
 * `debt.auditDocsLines` counts the non-blank lines of the `.md` files *directly* under
 * `docs/audit` — `countDocsProseLines` uses `readdirSync`, not a walk — so moving a
 * superseded register into a subdirectory takes its lines out of the debt gate. That is
 * the intent: the ceiling exists to keep the audit prose a reader has to keep honest
 * from growing without bound, and a round report nobody maintains is not that prose.
 * But an unpoliced subdirectory is a bypass — `mkdir archive` and the ceiling is
 * decorative again — so arrival here is a declared act. The list below is the whole
 * inventory and both directions are checked: a file without a declaration is red, and
 * so is a declaration whose file has left, because an orphan row reads to the next
 * author as a register that still exists.
 *
 * The second test is the one that caught work during the move itself: a path reference
 * to an archived file keeps spelling the location it no longer has, and only a reader
 * who opens the link would notice. Bare-name mentions are deliberately not policed —
 * `see EVALUATION_V2_REPORT` is not a path, it still resolves for a human, and a rule
 * demanding a prefix would only teach the next author to write `archive/` twice.
 */
import { describe, expect, it } from "vitest";
import { readRepo, walkRepo } from "./repo-tree";

const ARCHIVE_DIR = "docs/audit/archive";

/** Every file that has been retired here, by name. Add a row when retiring one. */
const ARCHIVED = [
  "EVALUATION_V2_REPORT.md",
  "LIGHTHOUSE_V10.md",
  "PAIN_REGISTER_V10.md",
  "PAIN_REGISTER_V8.md",
  "PAIN_REGISTER_V9.md",
  "RECONCILE_V10.md",
  "RECONCILE_V8.md",
  "S_VERIFY_V8.md",
  "U2_ASSESSMENT_V10.md",
];

/**
 * The directory's own policy file, which is not a retired register and so is not part of
 * the inventory above. Named separately because the point of the inventory is that
 * *nothing else* may appear here without a row.
 */
const POLICY_FILES = ["README.md"];

/**
 * Where a live path reference to an audit document can legitimately live. Named
 * explicitly rather than walked from the repository root: a root walk reaches `.next`,
 * `node_modules` and `artifacts`, and a guard that scans generated output reports
 * yesterday's spellings as today's defects.
 */
const SCAN_DIRS = ["docs", "src", "tests", "scripts", "apps", ".github"];
const SCAN_ROOT_FILES = ["README.md", "AGENTS.md"];
const TEXT_FILE = /\.(md|mdx|ts|tsx|js|jsx|mjs|cjs|json|ya?ml)$/;

const ARCHIVED_NAMES = new Set(ARCHIVED);

/**
 * This file has to spell the old paths — that is what its fixture proves the detector
 * catches — so it is the one live file excluded from the scan. Declared rather than
 * patterned out: a rule that skipped every file mentioning its own name would skip the
 * next author's honest mistake too.
 */
const SELF = "tests/unit/audit-archive-is-declared.test.ts";

/** Stale `docs/audit/<archived>.md` references in one text, as `file:line path`. */
export function staleRefsIn(rel: string, text: string): string[] {
  const hits: string[] = [];
  text.split("\n").forEach((line, i) => {
    for (const m of line.matchAll(/docs\/audit\/([A-Za-z0-9._-]+\.md)/g)) {
      if (ARCHIVED_NAMES.has(m[1])) hits.push(`${rel}:${i + 1} ${m[0]}`);
    }
  });
  return hits;
}

function scannedFiles(): string[] {
  return [
    ...SCAN_ROOT_FILES,
    ...SCAN_DIRS.flatMap((dir) => walkRepo(dir, (rel) => TEXT_FILE.test(rel))),
  ].filter((rel) => !rel.startsWith(`${ARCHIVE_DIR}/`) && rel !== SELF);
}

describe("the audit archive is declared, and nothing still points into the old path", () => {
  it("holds exactly the registers this file declares, in both directions", () => {
    const declared = [...ARCHIVED, ...POLICY_FILES];
    const present = walkRepo(ARCHIVE_DIR, (rel) => rel.endsWith(".md")).map((rel) => rel.slice(ARCHIVE_DIR.length + 1));
    expect([...present].sort(), `undeclared files in ${ARCHIVE_DIR}/: add a row, or they dodge the ceiling`).toEqual(
      [...declared].sort(),
    );
    const missing = declared.filter((name) => !present.includes(name));
    expect(missing, `declared but absent from ${ARCHIVE_DIR}/: ${missing.join(", ")}`).toEqual([]);
  });

  it("is reachable only through the archive path from every live file", () => {
    const offenders = scannedFiles().flatMap((rel) => staleRefsIn(rel, readRepo(rel)));
    expect(
      offenders,
      `references to an archived register at its pre-move path:\n${offenders.map((o) => `  ${o}`).join("\n")}`,
    ).toEqual([]);
    // The exemption above has to be paying for itself: this file really does carry the
    // spellings it excuses itself from, so the exemption cannot outlive them and quietly
    // become a hole through which the next stale path is committed.
    expect(
      staleRefsIn(SELF, readRepo(SELF)).length,
      `${SELF} no longer contains a pre-move path — remove the exemption, do not leave it guarding nothing`,
    ).toBeGreaterThan(0);
  });

  // The detector has to be able to fire, or the green above certifies nothing.
  it("names a pre-move path and stays quiet about the archive spelling", () => {
    expect(staleRefsIn("README.md", "scores live in docs/audit/LIGHTHOUSE_V10.md today")).toEqual([
      "README.md:1 docs/audit/LIGHTHOUSE_V10.md",
    ]);
    expect(staleRefsIn("README.md", "scores live in docs/audit/archive/LIGHTHOUSE_V10.md today")).toEqual([]);
    expect(staleRefsIn("docs/ARCHITECTURE.md", "see docs/audit/ARCHITECTURE_CURRENT.md")).toEqual([]);
    expect(staleRefsIn("docs/x.md", "two on one line: docs/audit/RECONCILE_V8.md and docs/audit/S_VERIFY_V8.md")).toHaveLength(2);
  });
});
