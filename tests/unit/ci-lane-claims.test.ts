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
import { readFileSync } from "node:fs";
import { readRepo, walkRepo } from "./repo-tree";
import { firstGoto, parseSpec, testBodies } from "./spec-ast";
import ts from "typescript";
import { describe, expect, it } from "vitest";

const read = (rel: string) => readFileSync(new URL(`../../${rel}`, import.meta.url), "utf8");

const pkg = JSON.parse(read("package.json")) as { scripts: Record<string, string> };
const workflow = read(".github/workflows/ci.yml");
const doc = read("docs/TESTING.md");

const specFilesOnDisk = walkRepo("tests", (rel) => rel.endsWith(".spec.ts")).sort();

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

/**
 * Which CI commands run which spec files, and how each one filters.
 *
 * The rule used to be per command: "if a lane greps a file down, the doc must
 * declare a partial row". That premise died with the split of `a11y-visual` into
 * an axe lane (`--grep-invert "Visual regression"`) and a visual lane
 * (`--grep "Visual regression"`): each command excludes titles the other
 * collects, so a per-command rule demanded a doc row for a gap that no longer
 * existed. What is actually worth checking is per title — is there any lane at
 * all that runs this test?
 */
interface Lane {
  script: string;
  files: string[];
  grep: string | null;
  invert: string | null;
}

const lanes: Lane[] = [];
for (const script of ciScripts) {
  const cmd = pkg.scripts[script] ?? "";
  if (!/\bplaywright\b/.test(cmd)) continue;
  lanes.push({
    script,
    files: [...cmd.matchAll(/(tests\/[^\s]+\.spec\.ts)/g)].map((m) => m[1]),
    grep: /--grep\s+"([^"]+)"/.exec(cmd)?.[1] ?? null,
    invert: /--grep-invert\s+"([^"]+)"/.exec(cmd)?.[1] ?? null,
  });
}

/** Titles some CI lane selects, unioned across the lanes that name the file. */
function collectedTitles(file: string): Set<string> {
  const out = new Set<string>();
  const all = testTitles(file);
  for (const lane of lanes) {
    if (!lane.files.includes(file)) continue;
    for (const title of all) {
      if (lane.grep && !new RegExp(lane.grep).test(title)) continue;
      if (lane.invert && new RegExp(lane.invert).test(title)) continue;
      out.add(title);
    }
  }
  return out;
}

function uncollected(file: string): string[] {
  const hit = collectedTitles(file);
  return testTitles(file).filter((t) => !hit.has(t));
}

const gaps = new Map<string, string[]>();
for (const file of specFilesOnDisk) {
  const miss = uncollected(file);
  if (miss.length > 0) gaps.set(file, miss);
}

describe("every test title is either run by CI or declared in the doc", () => {
  it("has lanes and filters to reason about, so nothing below is vacuous", () => {
    expect(lanes.length).toBeGreaterThan(1);
    expect(lanes.filter((l) => l.grep || l.invert).length, "no lane filters, so the union test is trivial").toBeGreaterThan(0);
    // The union must be able to be non-empty: a lane that selects nothing would
    // make every file look uncollected and the next two cases would agree with
    // each other instead of with CI.
    // 6 = four axe arms (landing, login, setup, interview room) plus the two snapshot
    // legs. Raised from 5 when `/setup` became a scanned route; the number is the
    // guard's own tripwire, so a renamed or dropped arm has to come here and say why.
    expect(collectedTitles("tests/a11y-visual.spec.ts").size).toBe(6);
  });

  it("names every route the axe lane actually navigates to", () => {
    // The route list in the doc's own sentence is a claim about code, so read it from
    // code: the first `page.goto()` inside each axe arm. When `/setup` became a scanned
    // route, the count check above moved and this row did not — it still named three of
    // the four, and nothing failed, because titles say nothing about destinations.
    const spec = "tests/a11y-visual.spec.ts";
    const sf = parseSpec(spec, read(spec));
    const arms = [...testBodies(sf)].filter(([title]) => /axe violations/.test(title));
    const routes = arms.map(([title, body]) => [title, firstGoto(sf, body)] as const);
    expect(
      routes.filter(([, r]) => r === null).map(([t]) => t),
      "an axe arm navigates in a shape this guard cannot read: update it rather than skip the case",
    ).toEqual([]);
    const row = doc.split("\n").find((l) => l.includes("test:e2e:axe")) ?? "";
    const named = (route: string) =>
      route.startsWith("/interview") ? row.includes("interview room") : row.includes(`\`${route.split("?")[0]}\``);
    const missing = routes.filter(([, r]) => !named(r as string)).map(([t, r]) => `${t} -> ${r}`);
    expect(missing, `docs/TESTING.md's E2E axe row does not name every scanned route:\n${missing.join("\n")}`).toEqual([]);
    expect(arms.length, "this row is vacuous if the lane has no arms").toBeGreaterThan(0);
  });

  it("collects a filtered file's titles across the lanes that split it", () => {
    // The visual tier: axe's lane drops the snapshot legs, the visual lane runs
    // only them. Neither command covers the file, the pair covers it completely.
    expect(uncollected("tests/a11y-visual.spec.ts")).toEqual([]);
    expect(
      gaps.has("tests/a11y-visual.spec.ts"),
      "the doc still declares a gap for a file both lanes together cover"
    ).toBe(false);
  });

  it.each([...gaps].map(([file, miss]) => [file, miss] as const))(
    "%s has exactly the declared number of tests no lane runs",
    (file, miss) => {
      const row = doc.split("\n").find((line) => line.includes(`\`${file}\``) && /→|\(\d+\)/.test(line));
      expect(row, `no row in "Specs no CI lane collects" for ${file}: ${miss.join(" | ")}`).toBeDefined();
      const declared = /\((\d+)\)/.exec(row ?? "");
      expect(declared, `the ${file} row states no count`).not.toBeNull();
      expect(
        Number(declared?.[1]),
        `doc says ${declared?.[1]} but no CI lane runs ${miss.length}: ${miss.join(" | ")}`
      ).toBe(miss.length);
      for (const quoted of [...row!.matchAll(/"([^"]+)"/g)].map((m) => m[1])) {
        expect(
          miss.some((t) => t.includes(quoted)),
          `row quotes "${quoted}", which no lane actually skips`
        ).toBe(true);
      }
    }
  );

  it("refuses a row whose gap has been closed", () => {
    const stale = [...declaredUncollected.keys()].filter((f) => !gaps.has(f));
    expect(stale, `declared uncollected but every title is now run: ${stale.join(", ")}`).toEqual([]);
  });

});

/**
 * The check list a reviewer sees on a PR is wider than the CI this repository
 * owns, and the difference is not cosmetic: a deployment status and an
 * out-of-band analysis app both render as green ticks. docs/TESTING.md tabulates
 * which lane comes from where, so the tabulation has to track the workflows in
 * both directions -- a job with no row is an unexplained gate, and a row that
 * claims a job CI does not define is a gate nobody will ever fail.
 */
const OWNERSHIP_SECTION = "### Which checks a PR shows";

function jobLabels(): { file: string; key: string; label: string }[] {
  const out: { file: string; key: string; label: string }[] = [];
  for (const rel of walkRepo(".github/workflows", (r) => r.endsWith(".yml"))) {
    const lines = readRepo(rel).split("\n");
    const start = lines.findIndex((l) => l === "jobs:");
    if (start === -1) continue;
    let current: { key: string; name?: string } | null = null;
    for (const line of lines.slice(start + 1)) {
      const job = /^  ([a-zA-Z0-9_-]+):\s*$/.exec(line);
      if (job) {
        if (current) out.push({ file: rel, key: current.key, label: current.name ?? current.key });
        current = { key: job[1] };
        continue;
      }
      const named = /^\s{4}name:\s*(.+)$/.exec(line);
      if (named && current) current.name = named[1].trim().replace(/^"|"$/g, "");
    }
    if (current) out.push({ file: rel, key: current.key, label: current.name ?? current.key });
  }
  return out;
}

const derived = jobLabels();
/** `Analyze (${{ matrix.language }})` is announced by the prefix before the paren. */
const baseOf = (label: string) => label.split(" (")[0].replace(/\$\{\{.*$/, "").trim();
const docOwnership = (() => {
  const section = doc.split(OWNERSHIP_SECTION)[1] ?? "";
  const rows: { name: string; external: boolean }[] = [];
  for (const m of section.matchAll(/^\| `([^`]+)` \| (.*?) \|/gm)) {
    rows.push({ name: m[1], external: /\*\*not this repo\*\*/.test(m[2]) });
  }
  return rows;
})();

describe("the CI ownership table matches the workflows", () => {
  it("reads real jobs from real workflows (the comparison below needs both sides)", () => {
    expect(derived.length, "no jobs parsed out of .github/workflows").toBeGreaterThanOrEqual(6);
    expect(docOwnership.length).toBeGreaterThanOrEqual(derived.length);
  });

  it("has a row for every job this repo defines", () => {
    const documented = new Set(docOwnership.map((r) => baseOf(r.name)));
    const unowned = derived.filter((j) => !documented.has(baseOf(j.label)));
    expect(
      unowned.map((j) => `${j.file} → ${j.label}`),
      "a CI job exists that the ownership table never accounts for"
    ).toEqual([]);
  });

  it("claims no row for a job that does not exist", () => {
    const defined = new Set(derived.map((j) => baseOf(j.label)));
    const claimedInternal = docOwnership.filter((r) => !r.external && !defined.has(baseOf(r.name)));
    expect(claimedInternal.map((r) => r.name), "the doc says this repo runs a check it does not define").toEqual([]);
  });

  it("keeps every external row external", () => {
    const defined = new Set(derived.map((j) => baseOf(j.label)));
    const mislabelled = docOwnership.filter((r) => r.external && defined.has(baseOf(r.name)));
    expect(
      mislabelled.map((r) => r.name),
      'a check marked **not this repo** is now defined by a workflow in this tree' 
    ).toEqual([]);
  });
});
