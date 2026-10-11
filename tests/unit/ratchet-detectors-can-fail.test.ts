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

/** The five regex-driven keys, each written out so TS can see a real string. */
const REGEX_ARMS: Arm[] = [
  {
    key: "deprecatedObjectGenFiles",
    measure: (t) => measureDebtRegex("deprecatedObjectGenFiles", t),
    bad: "const r = await generateObject({ schema, prompt });",
    good: "const r = await streamText({ model, prompt });",
  },
  {
    key: "experimentalRepairTextHits",
    measure: (t) => measureDebtRegex("experimentalRepairTextHits", t),
    bad: "const o = { experimental_repairText: async (t) => t };",
    good: "const o = { repairText: async (s) => s };",
  },
  {
    key: "selectStarHits",
    measure: (t) => measureDebtRegex("selectStarHits", t),
    bad: `await supabase.from("interviews").select("*");`,
    good: `await supabase.from("interviews").select("id, createdAt");`,
  },
  {
    key: "tsIgnoreHits",
    measure: (t) => measureDebtRegex("tsIgnoreHits", t),
    bad: "// @ts-ignore the shape is not typed yet\nconst a = b;",
    good: "// @ts-check is enabled for this project\nconst a = b;",
  },
  {
    key: "todoMarkers",
    measure: (t) => measureDebtRegex("todoMarkers", t),
    bad: "// TODO: replace the stub before shipping\nconst a = 1;",
    good: "// replaced the stub last sprint\nconst a = 1;",
  },
];

const OTHER_ARMS: Arm[] = [
  {
    key: "anyEscapes",
    measure: (t) => countAnyEscapes(t, "a.ts"),
    bad: "const parsed: any = JSON.parse(raw);",
    good: "const parsed: Record<string, string> = JSON.parse(raw);",
  },
  {
    key: "neverCasts",
    measure: (t) => countNeverAssertions(t, "a.ts"),
    bad: "setMessages(snapshot.messages as never[]);",
    good: "setMessages(toUiMessages(snapshot.messages));",
  },
  {
    key: "mouseOnlyInteractions",
    measure: (t) => countMouseOnlyInteractions(t, "a.tsx"),
    bad: "const C = () => <div onClick={() => open()}>drop a file</div>;",
    good: "const C = () => <div onClick={() => open()} onKeyDown={() => open()} tabIndex={0}>drop a file</div>;",
  },
  {
    key: "deadControls",
    // returns the findings themselves, which is what makes the names auditable
    measure: (t) => findDeadControls(t, "a.tsx").length,
    bad: "const C = () => <button onClick={() => {}}>Share</button>;",
    good: "const C = () => <button onClick={() => navigator.share({ title: \"x\" })}>Share</button>;",
  },
  {
    key: "networkLayer.rawFetchCalls",
    measure: (t) => countRawFetchCallSites(t, "a.ts"),
    bad: 'const r = await fetch("/api/copilot", { method: "POST" });',
    good: 'const r = await postJson("/api/copilot", body);',
  },
];

const ARMS: Arm[] = [...REGEX_ARMS, ...OTHER_ARMS];

describe("every debt detector can actually fail", () => {
  it("has an arm for every regex it registers", () => {
    // `measureDebtRegex` throws on an unregistered key, so the table and the arms
    // have to agree in both directions or a new pattern arrives unchecked.
    expect(
      Object.keys(DEBT_REGEX)
        .filter((k) => !REGEX_ARMS.some((a) => a.key === k))
        .concat(REGEX_ARMS.filter((a) => !(a.key in DEBT_REGEX)).map((a) => a.key))
    ).toEqual([]);
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
    const sibling = readFileSync(
      new URL("../../tests/unit/facts-ratchet.test.ts", import.meta.url),
      "utf8"
    );
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
    const sibling = readFileSync(
      new URL("../../tests/unit/facts-ratchet.test.ts", import.meta.url),
      "utf8"
    );
    expect(sibling).toContain("countHardInternalNavigations");
    expect(sibling, "a string that appears nowhere must not be credited as coverage").not.toContain(
      "countDocsProseLines"
    );
  });
});
