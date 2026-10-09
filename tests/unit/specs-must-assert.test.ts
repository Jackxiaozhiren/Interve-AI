/**
 * A Playwright spec that cannot fail is not a test.
 *
 * `tests/e2e/core-visual-consistency.spec.ts` navigates, writes PNGs and logs
 * `[PASS]` — with zero assertions and a try/catch around every step, so it
 * reports success whatever the product does. That is admitted in
 * `docs/TESTING.md`'s exclusion table and the file is not collected by CI, which
 * is the honest outcome. This test is what keeps the admission honest: the claim
 * lives in prose, and prose rots.
 *
 * Two directions are pinned, so neither drift can pass:
 *   - a spec with no assertion must be named in that table, with the reason
 *     spelled out in the row;
 *   - a row that says "zero assertions" must still describe a file with zero
 *     assertions — adding the first `expect(` to it forces the row to be
 *     deleted, which is the point of collecting the file in the first place.
 *
 * The scan is comment-blind: a sentence about assertions is not one, or the
 * guard that polices this rule could satisfy itself with a docstring.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { describe, expect, it } from "vitest";

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(new URL(`../../${dir}`, import.meta.url))) {
    const rel = `${dir}/${entry}`;
    if (statSync(new URL(`../../${rel}`, import.meta.url)).isDirectory()) out.push(...walk(rel));
    else if (rel.endsWith(".spec.ts")) out.push(rel);
  }
  return out;
}

/** Strip block and line comments so prose about a handler is not a call site. */
function codeOnly(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/^\s*\/\/.*$/gm, " ");
}

const SPECS = walk("tests").sort();
const WITHOUT_ASSERTIONS = SPECS.filter(
  (f) => !/\bexpect\s*\(/.test(codeOnly(readFileSync(new URL(`../../${f}`, import.meta.url), "utf8")))
);

const TABLE = readFileSync(new URL("../../docs/TESTING.md", import.meta.url), "utf8");
const ROWS = TABLE.split("\n").filter((l) => l.startsWith("| `tests/"));

describe("every Playwright spec can fail", () => {
  it("has specs to judge, most of them asserting", () => {
    // Sanity: an empty or all-exempt inventory would make the rules below pass
    // on nothing.
    expect(SPECS.length).toBeGreaterThanOrEqual(15);
    expect(SPECS.length - WITHOUT_ASSERTIONS.length).toBeGreaterThanOrEqual(SPECS.length - 2);
  });

  it("names every assertion-less spec in docs/TESTING.md, with a reason", () => {
    const undeclared = WITHOUT_ASSERTIONS.filter(
      (f) => !ROWS.some((row) => row.includes(f) && /zero assertions/.test(row))
    );
    expect(undeclared, `add a row to the exclusion table explaining why: ${undeclared.join(", ")}`).toEqual([]);
  });

  it("keeps the table honest in the other direction", () => {
    const stale = ROWS.filter((row) => /zero assertions/.test(row)).filter((row) => {
      const file = row.match(/`(tests\/[^`]+\.spec\.ts)`/)?.[1];
      if (!file) return false;
      return /\bexpect\s*\(/.test(codeOnly(readFileSync(new URL(`../../${file}`, import.meta.url), "utf8")));
    });
    expect(stale, `these specs now assert — delete the row and wire them into a lane:\n${stale.join("\n")}`).toEqual([]);
  });

  it("does not let the sweep claim routes that do not exist", () => {
    // The same file visits `/history` and `/settings`, which are not app routes:
    // with no assertions it screenshots a 404 and logs PASS.
    const src = codeOnly(readFileSync(new URL("../../tests/e2e/core-visual-consistency.spec.ts", import.meta.url), "utf8"));
    expect(src).not.toMatch(/url: ['"]\/history['"]/);
    expect(src).not.toMatch(/url: ['"]\/settings['"]/);
  });
});

/**
 * An assertion whose subject is a literal cannot fail, so it is not an assertion
 * — it is a token that satisfies "this file contains `expect(`".
 *
 * `tests/integration/zz-probe.test.ts` ended with `expect(true).toBe(true)` after
 * five live provider calls whose results it printed and never checked. The rule
 * above (a file must contain an `expect(`) rated it as asserting, which is how I
 * first measured this corpus and reported zero offenders: the presence of the word
 * was the whole test. A file can now satisfy "has assertions" only by constraining
 * something the product produced.
 */
const TEST_FILES = (() => {
  const out: string[] = [];
  (function walk(dir: string): void {
    for (const entry of readdirSync(new URL(`../../${dir}`, import.meta.url))) {
      const rel = `${dir}/${entry}`;
      if (statSync(new URL(`../../${rel}`, import.meta.url)).isDirectory()) walk(rel);
      else if (/\.tsx?$/.test(entry)) out.push(rel);
    }
  })("tests");
  return out.sort();
})();

// `expect(<literal>).<matcher>(<literal or nothing>)` — both sides fixed, so the
// verdict is decided at write time. A computed matcher argument (`expect(false)`
// `.toBe(hasQuota)`) is a real question and is not matched.
const LITERAL = "(?:true|false|null|undefined|[-+]?\\d+(?:\\.\\d+)?|\"\"|''|``)";
const TAUTOLOGY = new RegExp(
  "\\bexpect(?:\\s*<[^>]*>)?\\s*\\(\\s*" + LITERAL + "\\s*\\)\\s*\\.\\w+\\s*\\(\\s*" + LITERAL + "?[\\s,)]",
  "g"
);

describe("no test asserts against a literal", () => {
  const offenders = TEST_FILES.filter((f) =>
    TAUTOLOGY.test(codeOnly(readFileSync(new URL(`../../${f}`, import.meta.url), "utf8")))
  );

  it("recognises the shape it is looking for (the scan is not decoration)", () => {
    // The samples are assembled rather than written out: a scanner whose fixture
    // contains the offending text reports its own file as an offender, which is
    // how a guard ends up needing an exemption for itself.
    const yes = "expect" + "(true).toBe(true);";
    const yesToo = "expect" + "(true).toBeTruthy();";
    const no = "expect(rows.length)" + ".toBe(3);";
    const noEither = "expect(false)" + ".toBe(subject.hasQuota);";
    expect(TAUTOLOGY.test(yes)).toBe(true);
    TAUTOLOGY.lastIndex = 0;
    expect(TAUTOLOGY.test(yesToo)).toBe(true);
    TAUTOLOGY.lastIndex = 0;
    // a real question: the subject is product output, not a typed literal
    expect(TAUTOLOGY.test(no)).toBe(false);
    TAUTOLOGY.lastIndex = 0;
    expect(TAUTOLOGY.test(noEither)).toBe(false);
    TAUTOLOGY.lastIndex = 0;
  });

  it("finds no tautological assertion in any test file", () => {
    expect(offenders, `assert on something the code produced: ${offenders.join(", ")}`).toEqual([]);
  });

  it("is judging real files, not an empty list", () => {
    expect(TEST_FILES.length).toBeGreaterThanOrEqual(100);
  });
});
