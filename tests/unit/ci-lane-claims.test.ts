/**
 * What CI actually executes, versus what this repo's testing doc says it does.
 *
 * docs/TESTING.md used to describe `npm run test:e2e` — the 12-project matrix —
 * as a "CI lane". It is not one: the workflow only ever calls the smoke and mock
 * commands, and it installs chromium alone, so eleven of the twelve projects
 * could not run there even if it did. Six spec files (15 tests) had never been
 * collected by any job, and nothing failed because of it, because Playwright is
 * happy to report "0 tests" as success.
 *
 * So the check is set arithmetic over primary artifacts rather than a read of
 * the prose: enumerate the specs on disk, subtract the ones every CI command
 * names, and require the remainder to appear in the doc's own table. A new spec
 * that nobody runs goes red; so does a table row that outlives its gap.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import ts from "typescript";
import { describe, expect, it } from "vitest";

const read = (rel: string) => readFileSync(new URL(`../../${rel}`, import.meta.url), "utf8");

const pkg = JSON.parse(read("package.json")) as { scripts: Record<string, string> };
const workflow = read(".github/workflows/ci.yml");
const doc = read("docs/TESTING.md");

const specFilesOnDisk = (() => {
  const out: string[] = [];
  (function walk(dir: string): void {
    for (const entry of readdirSync(new URL(`../../${dir}`, import.meta.url))) {
      const rel = `${dir}/${entry}`;
      if (statSync(new URL(`../../${rel}`, import.meta.url)).isDirectory()) walk(rel);
      else if (entry.endsWith(".spec.ts")) out.push(rel);
    }
  })("tests");
  return out.sort();
})();

/** `npm run <script>` invocations the gate job actually makes. */
const ciScripts = [...new Set([...workflow.matchAll(/npm run (test[\w:-]*)/g)].map((m) => m[1]))];

/** Spec paths named by a CI playwright command, and whether any of them is filtered. */
const collected = new Map<string, boolean>();
for (const script of ciScripts) {
  const cmd = pkg.scripts[script] ?? "";
  if (!/\bplaywright\b/.test(cmd)) continue;
  const filtered = /--grep(?:-invert)?/.test(cmd);
  for (const m of cmd.matchAll(/(tests\/[^\s]+\.spec\.ts)/g)) {
    collected.set(m[1], (collected.get(m[1]) ?? false) || filtered);
  }
}

/** Rows of the doc's own "no CI lane collects" table. */
const declaredUncollected = new Map<string, boolean>();
{
  const section = doc.split(/^### Specs no CI lane collects$/m)[1] ?? "";
  const body = section.split(/^\| Golden journey|^Golden journey/m)[0];
  for (const m of body.matchAll(/\|\s*`(tests\/[^`]+\.spec\.ts)`([^|]*)\|/g)) {
    declaredUncollected.set(m[1], /→/.test(m[2]));
  }
}

describe("the CI lane inventory matches the CI file", () => {
  it("collects at least one spec, so the comparison below is not vacuous", () => {
    // A parser that matches nothing also "proves" every assertion after it.
    expect(collected.size).toBeGreaterThan(3);
    expect(ciScripts.length).toBeGreaterThan(0);
  });

  it("has a doc row for every spec no CI command names", () => {
    const silent = specFilesOnDisk.filter((f) => !collected.has(f) && !declaredUncollected.has(f));
    expect(silent, `unrun and undeclared: ${silent.join(", ")}`).toEqual([]);
  });

  it("keeps every doc row attached to a spec CI genuinely skips", () => {
    const stale = [...declaredUncollected.keys()].filter((f) => collected.has(f) && !collected.get(f));
    expect(stale, `now collected but still declared: ${stale.join(", ")}`).toEqual([]);
  });

  it("marks a partial row only where a CI command actually filters that file", () => {
    // The a11y-visual row lists the two snapshot legs it excludes; that is only
    // honest while some command runs the file with a grep filter.
    const wrong = [...declaredUncollected].filter(([f, partial]) => partial && !collected.get(f));
    expect(wrong, `declared partial but unfiltered: ${wrong.map(([f]) => f).join(", ")}`).toEqual([]);
  });

  it("declares only specs that still exist", () => {
    for (const f of declaredUncollected.keys()) {
      expect(specFilesOnDisk, f).toContain(f);
    }
  });

  it("names only scripts that exist, in every command the doc shows", () => {
    const cited = [...new Set([...doc.matchAll(/npm run ([\w:-]+)/g)].map((m) => m[1]))];
    const missing = cited.filter((s) => !(s in pkg.scripts));
    expect(missing, `doc cites unknown scripts: ${missing.join(", ")}`).toEqual([]);
  });

  it("documents every test script the gate runs", () => {
    const undocumented = ciScripts.filter((s) => !doc.includes(`npm run ${s}`));
    expect(undocumented, `run by CI but absent from TESTING.md: ${undocumented.join(", ")}`).toEqual([]);
  });

  it("cites only spec paths that exist", () => {
    const cited = [...new Set([...doc.matchAll(/`(tests\/[^\s`]+\.spec\.ts)`/g)].map((m) => m[1]))];
    const ghost = cited.filter((f) => !specFilesOnDisk.includes(f));
    expect(ghost, `doc cites missing specs: ${ghost.join(", ")}`).toEqual([]);
  });
});

/**
 * The partial rows carry a count — `"Visual regression" (2)` — and a count that
 * nobody recomputes is a transcription, not a check. Adding a third snapshot leg
 * to the file would leave the doc claiming two and this suite still green, which
 * is the exact failure mode the rest of this file exists to close.
 *
 * So the number is derived from primary artifacts: the grep pattern the CI
 * command actually passes, matched against the test titles Playwright would see
 * in that file (describe title joined to test title with " > ", which is what
 * `--grep` is applied to).
 */
function testTitles(rel: string): string[] {
  const src = read(rel);
  const sf = ts.createSourceFile(rel, src, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const titles: string[] = [];

  const literal = (n: ts.Node | undefined): string | null =>
    n && ts.isStringLiteral(n) ? n.text : null;

  const walk = (node: ts.Node, ancestors: string[]) => {
    if (ts.isCallExpression(node)) {
      const callee = node.expression;
      // `describe`, `test.describe`, `test.skip`, `it` — Playwright and Vitest
      // both spell these, and an inventory that only recognises the bare form
      // silently loses every title nested under the dotted one.
      const head = ts.isIdentifier(callee)
        ? callee.text
        : ts.isPropertyAccessExpression(callee) && ts.isIdentifier(callee.expression)
          ? `${callee.expression.text}.${callee.name.text}`
          : null;
      const isDescribe = head === "describe" || head === "test.describe";
      const isTest = head !== null && !isDescribe && /^(test|it)(\.|$)/.test(head);
      if (isTest || isDescribe) {
        const title = literal(node.arguments[0]);
        if (title !== null) {
          if (isDescribe) walk(node.arguments[1] as ts.Node, [...ancestors, title]);
          else titles.push([...ancestors, title].join(" > "));
          return;
        }
      }
    }
    node.forEachChild((c) => walk(c, ancestors));
  };
  walk(sf, []);
  return titles;
}

/** `--grep-invert "P" file.spec.ts` pairs, straight out of package.json. */
const filters: { file: string; pattern: string }[] = [];
for (const script of ciScripts) {
  const cmd = pkg.scripts[script] ?? "";
  const m = /--grep-invert\s+"([^"]+)"\s+(tests\/[^\s]+\.spec\.ts)/.exec(cmd);
  if (m) filters.push({ pattern: m[1], file: m[2] });
}

describe("the excluded-test counts in TESTING.md are derived", () => {
  it("finds at least one grep filter, so the checks below are not vacuous", () => {
    expect(filters.length).toBeGreaterThan(0);
  });

  it.each(filters.map((f) => [`${f.file} excluding /${f.pattern}/`, f] as const))(
    "%s",
    (_label, { file, pattern }) => {
      const excluded = testTitles(file).filter((t) => new RegExp(pattern).test(t));
      // Non-vacuity: the pattern must really exclude something in that file.
      expect(excluded.length, `no title in ${file} matches /${pattern}/`).toBeGreaterThan(0);

      const row = doc
        .split("\n")
        .find((line) => line.includes(`\`${file}\``) && /→/.test(line));
      expect(row, `no partial row for ${file}`).toBeDefined();

      const declared = /\((\d+)\)/.exec(row ?? "");
      expect(declared, `the ${file} row states no count`).not.toBeNull();
      expect(
        Number(declared?.[1]),
        `doc says ${(declared?.[1])} but ${pattern} excludes ${excluded.length}: ${excluded.join(" | ")}`
      ).toBe(excluded.length);

      // Whatever the row quotes must be a title the pattern really excludes.
      for (const quoted of [...row!.matchAll(/"([^"]+)"/g)].map((m) => m[1])) {
        expect(
          excluded.some((t) => t.includes(quoted)),
          `row quotes "${quoted}", which /${pattern}/ does not exclude`
        ).toBe(true);
      }
    }
  );
});
