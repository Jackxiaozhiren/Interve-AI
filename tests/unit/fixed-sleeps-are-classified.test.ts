/**
 * Every fixed wait in a browser spec has to say what kind of claim it is carrying.
 *
 * `page.waitForTimeout(n)` is the one construct in the suite that can make a green test
 * mean nothing: it fixes the earliest moment a failure may be reported, and it cannot
 * distinguish "the thing arrived" from "the thing never arrives". Two of the five this
 * round started with were sitting directly in front of an assertion that already retries
 * (`toBeFocused`, and a `count()` sum that read 0 for both branches while the toast had
 * not painted), where the sleep was pure cost — and one of them was in front of an arm
 * whose comment claimed it verified a crash would be noticed, while nothing collected
 * crashes.
 *
 * So a sleep must now carry `// sleep-ok: <class>` on the line above it, and the class
 * has to be one of the three below. The point is not formatting: it is that the only
 * honest reasons are short and enumerable, and a fourth reason means a condition was
 * available and someone chose not to write it.
 *
 * Checked in both directions, because a marker left behind by a deleted sleep reads to
 * the next reader as a wait that is still there and still justified. And a class nobody
 * uses is deleted rather than kept as vocabulary: an unused exemption is how a rule
 * quietly grows a hole with a name on it.
 *
 * The scope is every `*.spec.ts` under `tests/`, including the ones no CI lane runs. A
 * derived denominator ("specs the lanes actually execute") would have to read shell
 * strings out of `package.json`, and a guard that goes blind when someone renames a
 * script is a worse instrument than one that asks eight honest questions about a spec
 * that asserts nothing.
 */
import ts from "typescript";
import { describe, expect, it } from "vitest";
import { readRepo, walkRepo } from "./repo-tree";

/** The reasons a fixed wait can legitimately exist. Each one is a claim, not a mood. */
export const SLEEP_CLASSES = ["absence-window", "screenshot-stability"] as const;

const MARKER = /^\s*\/\/\s*sleep-ok:\s*([a-z][a-z-]*)/;
const COMMENT = /^\s*(\/\/|\*|\/\*)/;

/** The marker inside the comment block that sits directly above line `i`, if any. */
function markerAbove(lines: string[], i: number): string | null {
  let j = i - 1;
  while (j >= 0 && lines[j].trim() === "") j--;
  const block: string[] = [];
  while (j >= 0 && COMMENT.test(lines[j])) {
    block.push(lines[j]);
    j--;
  }
  for (const line of block) {
    const m = MARKER.exec(line);
    if (m) return m[1];
  }
  return null;
}

/**
 * A marker attaches to the sleep that follows it across blank lines and further comment
 * lines — a reason worth stating is rarely a single line long. It does not attach across
 * a statement, so a marker parked above unrelated code next to a sleep stays unclassified.
 */
export interface SleepSite {
  /** `path:line`. */
  where: string;
  /** The marker class found above it, or null when there is none. */
  declared: string | null;
}

/** Every `waitForTimeout` call in a parsed spec, with the marker block above it. */
export function sleepSites(rel: string, sf: ts.SourceFile): SleepSite[] {
  const lines = sf.getFullText().split("\n");
  const found: SleepSite[] = [];
  const visit = (node: ts.Node) => {
    if (
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression) &&
      node.expression.name.text === "waitForTimeout"
    ) {
      const line = sf.getLineAndCharacterOfPosition(node.getStart(sf)).line;
      found.push({ where: `${rel}:${line + 1}`, declared: markerAbove(lines, line) });
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return found;
}

/** Markers that no longer sit in front of a sleep, as `path:line text`. */
export function orphanMarkers(rel: string, text: string): string[] {
  const lines = text.split("\n");
  const out: string[] = [];
  lines.forEach((line, i) => {
    if (!MARKER.test(line)) return;
    let next = i + 1;
    while (next < lines.length && (lines[next].trim() === "" || COMMENT.test(lines[next]))) next++;
    if (next >= lines.length || !/waitForTimeout\s*\(/.test(lines[next])) {
      out.push(`${rel}:${i + 1} ${line.trim()}`);
    }
  });
  return out;
}

const SPECS = () => walkRepo("tests", (rel) => rel.endsWith(".spec.ts")).sort();

describe("fixed waits in browser specs declare what they are waiting for", () => {
  it("finds the sleeps this rule was written against", () => {
    // Negative control for the walk itself: a rule that enumerates nothing is green
    // forever. Deliberately not an exact count — converting a sleep to a condition is
    // the improvement this file asks for, and a pinned number would price it as a
    // regression. At zero sleeps the right move is to delete this guard, not lower it.
    const sites = SPECS().flatMap((rel) => sleepSites(rel, ts.createSourceFile(rel, readRepo(rel), ts.ScriptTarget.Latest, true)));
    expect(sites.length, "the walk found no fixed waits at all — is the corpus still there?").toBeGreaterThan(0);
    expect(sites.every((s) => s.where.startsWith("tests/")), "a sleep outside tests/").toBe(true);
  });

  it("has a class for every sleep, and only classes it declares", () => {
    const problems: string[] = [];
    for (const rel of SPECS()) {
      const text = readRepo(rel);
      const sf = ts.createSourceFile(rel, text, ts.ScriptTarget.Latest, true);
      for (const site of sleepSites(rel, sf)) {
        if (site.declared === null) problems.push(`${site.where}: no sleep-ok class above it`);
        else if (!(SLEEP_CLASSES as readonly string[]).includes(site.declared)) {
          problems.push(`${site.where}: unknown class "${site.declared}"`);
        }
      }
      problems.push(...orphanMarkers(rel, text).map((o) => `${o} — no sleep below this marker`));
    }
    expect(
      problems,
      `fixed waits that are unclassified, mis-classified, or marked with nothing beside them:\n${problems.map((p) => `  ${p}`).join("\n")}`,
    ).toEqual([]);
  });

  it("declares no class that nothing uses", () => {
    const used = new Set(
      SPECS()
        .flatMap((rel) => sleepSites(rel, ts.createSourceFile(rel, readRepo(rel), ts.ScriptTarget.Latest, true)))
        .map((s) => s.declared),
    );
    const unused = SLEEP_CLASSES.filter((c) => !used.has(c));
    expect(unused, `classes with no sleep behind them: ${unused.join(", ")} — delete them`).toEqual([]);
  });

  // The three checks above are green on arrival, so the classifier's own teeth are
  // proven here: each shape the rule exists to catch has to be caught in a fixture.
  it("catches the three shapes it exists to catch", () => {
    const parse = (body: string) => ts.createSourceFile("f.spec.ts", body, ts.ScriptTarget.Latest, true);
    const BARE = `test('t', async ({ page }) => {\n  await page.waitForTimeout(500);\n});\n`;
    const UNKNOWN = `test('t', async ({ page }) => {\n  // sleep-ok: because-i-said-so\n  await page.waitForTimeout(500);\n});\n`;
    const WRAPPED = `test('t', async ({ page }) => {\n  // sleep-ok: absence-window — the claim is that nothing\n  // arrives, and an absence needs a bounded window.\n  await page.waitForTimeout(500);\n});\n`;
    const ORPHAN = `test('t', async ({ page }) => {\n  // sleep-ok: absence-window\n  const x = 1;\n  await page.waitForTimeout(500);\n});\n`;

    expect(sleepSites("f.ts", parse(BARE))[0].declared, "an unmarked sleep was accepted").toBeNull();
    expect(sleepSites("f.ts", parse(UNKNOWN))[0].declared, "the class was not read off the marker").toBe("because-i-said-so");
    expect(sleepSites("f.ts", parse(WRAPPED))[0].declared, "a marker wrapped over two lines was missed").toBe("absence-window");
    expect(orphanMarkers("f.ts", ORPHAN), "a marker parked above unrelated code attached anyway").toEqual([
      "f.ts:2 // sleep-ok: absence-window",
    ]);
    expect(orphanMarkers("f.ts", WRAPPED), "a wrapped marker was reported as orphaned").toEqual([]);
  });
});
