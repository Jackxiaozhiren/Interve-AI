/**
 * Every ratchet detector has to be able to produce a non-zero number, or the
 * ledger is guarding nothing.
 *
 * `facts:check` proves the *current* measurement is under its ceiling. It cannot
 * prove the measurement would notice a violation: a detector whose predicate
 * silently matches nothing reports 0 forever, sits under its ceiling forever, and
 * looks like the cleanest guard in the repo. This repo has already been bitten
 * twice — the catch-reason walk missed arrow-const aliases (false green over two
 * real offenders), and the eslint jsx-a11y rules under-count mouse-only controls
 * by two thirds in a framer-motion codebase.
 *
 * So each detector gets two fixtures: a violation that must be counted, and a
 * compliant sample that must not be. Both run through the collector's own
 * functions, so this file certifies the shipped predicates, not a copy of them.
 */
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  countAnyEscapes,
  countDocsProseLines,
  countMouseOnlyInteractions,
  countNeverAssertions,
  countRawFetchCallSites,
  DEBT_REGEX,
  findDeadControls,
  measureDebtRegex,
  RATCHET_KEYS,
} from "../../scripts/audit-facts.mjs";

type Arm = { key: string; measure: (text: string) => number; bad: string; good: string };

/**
 * One entry per detector, as a tuple: `[key, how to measure, a violation, a
 * compliant sample]`. Written as five-field object literals first, and SonarCloud's
 * new-code duplication gate failed the PR at 12.6% on nothing but the repeated
 * `key:` / `bad:` / `good:` scaffolding — a table-shaped addition wants tuples, not
 * a template.
 */
const ARM_FIXTURES: [key: string, measure: (text: string) => number, bad: string, good: string][] = [
  ["deprecatedObjectGenFiles", (t) => measureDebtRegex("deprecatedObjectGenFiles", t),
    "const r = await generateObject({ schema, prompt });", "const r = await streamText({ model, prompt });"],
  ["experimentalRepairTextHits", (t) => measureDebtRegex("experimentalRepairTextHits", t),
    "const o = { experimental_repairText: async (t) => t };", "const o = { repairText: async (s) => s };"],
  ["selectStarHits", (t) => measureDebtRegex("selectStarHits", t),
    `await supabase.from("interviews").select("*");`, `await supabase.from("interviews").select("id, createdAt");`],
  ["tsIgnoreHits", (t) => measureDebtRegex("tsIgnoreHits", t),
    "// @ts-ignore the shape is not typed yet\nconst a = b;", "// @ts-check is enabled for this project\nconst a = b;"],
  ["todoMarkers", (t) => measureDebtRegex("todoMarkers", t),
    "// TODO: replace the stub before shipping\nconst a = 1;", "// replaced the stub last sprint\nconst a = 1;"],
  ["anyEscapes", (t) => countAnyEscapes(t, "a.ts"),
    "const parsed: any = JSON.parse(raw);", "const parsed: Record<string, string> = JSON.parse(raw);"],
  ["neverCasts", (t) => countNeverAssertions(t, "a.ts"),
    "setMessages(snapshot.messages as never[]);", "setMessages(toUiMessages(snapshot.messages));"],
  ["mouseOnlyInteractions", (t) => countMouseOnlyInteractions(t, "a.tsx"),
    "const C = () => <div onClick={() => open()}>drop a file</div>;",
    "const C = () => <div onClick={() => open()} onKeyDown={() => open()} tabIndex={0}>drop a file</div>;"],
  // findDeadControls returns the findings themselves, which is what makes the names auditable
  ["deadControls", (t) => findDeadControls(t, "a.tsx").length,
    "const C = () => <button onClick={() => {}}>Share</button>;",
    "const C = () => <button onClick={() => navigator.share({ title: \"x\" })}>Share</button>;"],
  ["networkLayer.rawFetchCalls", (t) => countRawFetchCallSites(t, "a.ts"),
    'const r = await fetch("/api/copilot", { method: "POST" });', 'const r = await postJson("/api/copilot", body);'],
];

const ARMS: Arm[] = ARM_FIXTURES.map(([key, measure, bad, good]) => ({ key, measure, bad, good }));

/** Read once: two arms credit this sibling, and a second copy of the lookup is
 *  exactly the duplicated run the quality gate counts. */
const SIBLING = readFileSync(new URL("../../tests/unit/facts-ratchet.test.ts", import.meta.url), "utf8");
/** Derived, so the regex-arm check below cannot pass by keeping two lists in sync. */
const REGEX_KEYS = Object.keys(DEBT_REGEX);

describe("every debt detector can actually fail", () => {
  it("has an arm for every regex it registers", () => {
    // The direction that can rot: a new DEBT_REGEX entry arrives with a ceiling and
    // nobody proved it can move. The other direction is self-policing -- an arm
    // pointing at an unregistered key makes `measureDebtRegex` throw, so its
    // violation case goes red on its own.
    expect(REGEX_KEYS.filter((k) => !ARMS.some((a) => a.key === k))).toEqual([]);
  });
  it.each(ARMS)("$key flags its violation", ({ measure, bad }) => {
    expect(measure(bad), "a real violation went uncounted").toBeGreaterThan(0);
  });

  it.each(ARMS)("$key leaves compliant code alone", ({ measure, good }) => {
    expect(measure(good), "compliant code is being counted as debt").toBe(0);
  });

  it("counts prose lines over a docs directory, and would notice one more file", () => {
    // auditDocsLines reads the tree, so it gets a directory fixture rather than a
    // source string: two files of 2 and 3 lines must total 5, and a stray .txt in
    // the same directory must not be counted.
    const dir = mkdtempSync(path.join(tmpdir(), "docs-prose-"));
    try {
      writeFileSync(path.join(dir, "A.md"), "one\ntwo\n");
      writeFileSync(path.join(dir, "B.md"), "one\ntwo\nthree\n");
      writeFileSync(path.join(dir, "notes.txt"), "ignored\nignored\nignored\nignored\n");
      const lines = (s: string) => s.split("\n").length;
      expect(countDocsProseLines(dir)).toBe(lines("one\ntwo\n") + lines("one\ntwo\nthree\n"));
      writeFileSync(path.join(dir, "C.md"), "added\n");
      expect(countDocsProseLines(dir), "the ceiling cannot notice new audit prose")
        .toBe(lines("one\ntwo\n") + lines("one\ntwo\nthree\n") + lines("added\n"));
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("proves nothing is exempted by forgetting to add an arm", () => {
    // The completeness half: a new ratchet key with no can-fail evidence anywhere
    // reddens this. Sibling coverage is verified by reading the other file's test
    // titles, so a comment here cannot claim it.
    const coveredHere = new Set(ARMS.map((a) => a.key).concat(["auditDocsLines"]));
    const siblingCover = new Map([
      ["hardInternalNavigations", "countHardInternalNavigations"],
      ["unreferencedProductionDeps", "production dependencies the code does not back"],
      ["longestSourceFileLines", "reports the longest source file as a line count"],
      ["untestedChatCallbacks", "flags a callback used in src that no test names"],
    ]);
    const sibling = SIBLING;
    const unproven = Object.keys(RATCHET_KEYS)
      .map((k) => k.replace(/^(debt|capabilities)\./, ""))
      .filter((k) => !coveredHere.has(k))
      .filter((k) => {
        const needle = siblingCover.get(k);
        return needle === undefined || !sibling.includes(needle);
      });
    expect(unproven, "ratchet keys with no detector shown to be able to fail").toEqual([]);
  });

  it("has a sibling that really does hold the coverage it is credited with", () => {
    // Control for the arm above: it keys on a title in another file, so prove the
    // lookup discriminates rather than matching the whole file trivially.
    const sibling = SIBLING;
    expect(sibling).toContain("countHardInternalNavigations");
    expect(sibling, "a string that appears nowhere must not be credited as coverage").not.toContain(
      "countDocsProseLines"
    );
  });
});
