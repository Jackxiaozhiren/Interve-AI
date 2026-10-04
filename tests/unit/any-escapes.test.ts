import { describe, expect, it } from "vitest";
import { countAnyEscapes, collectFacts } from "../../scripts/audit-facts.mjs";

/**
 * `debt.anyEscapes` is the ledger for explicit `any` escaping the strict
 * config, and it ceiling-0s that debt. It was measured by /\s*any\b over raw
 * file text, which cannot tell a type position from a sentence: a comment
 * reading "…at all: any error response fell into" reported one escape where the
 * code had none, and the gate went red on a prose edit.
 *
 * The same blind spot ran the other way — `Record<string, any>` was invisible to
 * the old pattern, so real debt could hide in a nested position. Counting
 * TSAnyKeyword nodes closes both directions at once.
 */
const cases: Array<[string, string, number]> = [
  ["annotation", "const x: any = 1;", 1],
  ["assertion", "const y = z as any;", 1],
  ["generic argument", "type A = Array<any>;", 1],
  ["value position of a Record (invisible to the old regex)", "type B = Record<string, any>;", 1],
  ["array shorthand", "type C = any[];", 1],
  ["two in one file", "const a: any = 1;\nconst b: any = 2;", 2],
  ["prose that reads like an annotation", "// there was no check at all: any error response fell into\nconst ok = 1;", 0],
  ["string containing the token", 'const msg = "value: any is not allowed";', 0],
  ["JSDoc mention", "/** @type {any} */\nconst q = 1;", 0],
];

describe.each(cases)("any-escape counter: %s", (_label, body, expected) => {
  it(`counts ${expected}`, () => {
    expect(countAnyEscapes(body, "probe.ts")).toBe(expected);
  });
});

// Measured at module load, not inside the test: collectFacts() parses every file
// under src/ and cost ~1.4s on an idle machine, which lost the default 5s test
// timeout whenever the suite ran under load — a red gate that meant nothing
// about the code. Module collection is not timed, so the number is still
// re-derived for every run.
const facts = collectFacts();

it("still reports the seeded ceiling for src/", () => {
  // 17 fetch sites had an equivalent control; this one guards the same way:
  // if the AST count ever moves off the ledger's 0, that is either newly
  // discovered debt or a probe that started counting something else, and both
  // need adjudicating rather than a ceiling edit.
  expect(facts.debt.anyEscapes).toBe(0);
});
