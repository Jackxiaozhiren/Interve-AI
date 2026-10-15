/**
 * The README's architecture paragraph counts things this repo can measure.
 *
 * It already gets pinned for the CI lanes (`readme-testing-claims.test.ts`) and it
 * still went stale there once. The counts in the AI paragraph had no owner at all,
 * and one of them was already wrong when this file was written: "Versioned prompts
 * src/ai/prompts/ (19 entries)" is the folder's file count, which includes
 * `index.ts` (the registry itself) and `strict-json.ts` (a suffix builders append,
 * not a prompt). Seventeen prompts are registered.
 *
 * So every number in that paragraph is now read from the artifact that owns it.
 */
import { describe, expect, it } from "vitest";
import { PROMPT_REGISTRY } from "@/ai/prompts";
import { measureDebtRegex } from "../../scripts/audit-facts.mjs";
import { readRepo, walkRepo } from "./repo-tree";

const readme = readRepo("README.md");
const sourceFiles = (dir = "src"): string[] => walkRepo(dir, (rel) => /\.tsx?$/.test(rel));

/** The integer inside the parentheses that follow a phrase in the README. */
function claimedNumber(after: string): number | null {
  const at = readme.indexOf(after);
  if (at < 0) return null;
  const m = /\((\d+)[^)]*\)/.exec(readme.slice(at, at + 400));
  return m ? Number(m[1]) : null;
}

/**
 * A README number and the measurement that owns it, compared.
 *
 * Four arms below need exactly this pair of assertions — "the sentence is still
 * there to read" and "it matches". Written inline four times it is the shape this
 * repo's duplication gate counts, so it lives here once.
 */
function expectClaim(claimed: number | null, measured: number, what: string): void {
  expect(claimed, `the README no longer states the ${what} count where this test reads it`).not.toBeNull();
  expect(claimed, `README says ${claimed}, the code measures ${measured} for ${what}`).toBe(measured);
}

function generateObjectRoutes(): number {
  return sourceFiles("src/app/api").filter((rel) => /\bgenerateObject\s*\(/.test(readRepo(rel))).length;
}

/** Occurrences of a token across `src/`, counted the same way for both sides. */
function countInSrc(re: RegExp): number {
  return sourceFiles().reduce((n, rel) => n + (readRepo(rel).match(re) ?? []).length, 0);
}

/** Files the collector's own debt regex matches — the ratchet's counting scope. */
function debtFiles(key: string): number {
  return sourceFiles().filter((rel) => measureDebtRegex(key, readRepo(rel)) > 0).length;
}

/**
 * Tables the shipped client writes rows into, read off the call shape
 * (`from('t')` followed by `insert`/`upsert`). Whitespace is folded first: a
 * chain broken over lines is the same call, and a line-scan would miss it.
 */
function writtenTables(): string[] {
  const folded = readRepo("src/lib/api-client.ts").replace(/\s+/g, " ");
  const found = new Set<string>();
  for (const m of folded.matchAll(/from\(\s*['"]([a-z_]+)['"]\s*\)(?:\.[a-zA-Z]+\([^)]*\))*\.(?:insert|upsert)\(/g)) {
    if (m[1]) found.add(m[1]);
  }
  return [...found].sort();
}

/** How many prompt modules carry the untrusted-input fence. */
function fencedPromptFiles(): number {
  return walkRepo("src/ai/prompts", (rel) => rel.endsWith(".ts")).filter(
    (rel) => /UNTRUSTED/.test(readRepo(rel))
  ).length;
}

describe("the README's architecture counts are the measured ones", () => {
  it("counts versioned prompts the way the registry counts them", () => {
    expectClaim(
      claimedNumber("Versioned prompts `src/ai/prompts/`"),
      PROMPT_REGISTRY.length,
      "registered prompt"
    );
  });

  it("counts the routes still on generateObject rather than the call sites", () => {
    expectClaim(claimedNumber("`generateObject` ("), generateObjectRoutes(), "route on generateObject");
  });

  it("registers every prompt the folder exports, and no id twice", () => {
    // Keyed on what the modules actually export, because `PromptRegistration.id`
    // holds the resolved string ("interview-system"), not the constant's name —
    // matching names against values reports seventeen orphans and proves nothing.
    const ids = PROMPT_REGISTRY.map((p) => String(p.id));
    expect(new Set(ids).size, "two registrations share an id").toBe(ids.length);

    const helpers = ["./index.ts", "./strict-json.ts"];
    const exported = Object.entries(
      import.meta.glob("../../src/ai/prompts/*.ts", { eager: true }) as Record<string, Record<string, unknown>>
    ).filter(([file]) => !helpers.includes(`./${file.split("/").pop()}`));

    const unregistered = exported.flatMap(([file, mod]) =>
      Object.entries(mod)
        .filter(([name, value]) => /_PROMPT_ID$/.test(name) && typeof value === "string")
        .filter(([, value]) => !ids.includes(value as string))
        .map(([name]) => `${file}:${name}`)
    );
    expect(unregistered, "a prompt module exports an id the registry never lists").toEqual([]);
  });


  it("agrees with the code about the system-to-instructions migration", () => {
    const at = readme.indexOf("migrated");
    expect(at, "the README no longer states the migration count").toBeGreaterThan(-1);
    const m = /^\s*(\d+)\/(\d+)/.exec(readme.slice(at + "migrated".length));
    expect(m, "the migration claim is no longer N/N").not.toBeNull();
    expect(countInSrc(/\binstructions:\s/g), `README claims ${m?.[1]} migrated`).toBe(Number(m?.[1]));
    expect(Number(m?.[2]), "the denominator and numerator must be measured, not typed").toBe(Number(m?.[1]));
    expect(countInSrc(/[{,]\s*system:\s/g), "a route went back to the v6 option name").toBe(0);
  });

  it("counts the prompt files that fence untrusted input", () => {
    expectClaim(
      claimedNumber("Untrusted resume/JD/answers are fenced as data"),
      fencedPromptFiles(),
      "untrusted-input fence"
    );
  });

  it("names how many files are still on the deprecated object APIs", () => {
    // This clause used to report what a third-party codemod would print, which
    // nothing here can observe. It now states the number a ratchet already bounds,
    // and is checked against both that ceiling and the collector's own regex.
    const m = /\b(\d+) files still call the deprecated object APIs\b/.exec(readme);
    const measured = debtFiles("deprecatedObjectGenFiles");
    expectClaim(m ? Number(m[1]) : null, measured, "file on a deprecated object API");
    const ceiling = JSON.parse(readRepo("docs/audit/facts.limits.json")).ceiling["debt.deprecatedObjectGenFiles"];
    expect(measured, "the README's number must be the ceiling it claims to name").toBe(ceiling);
  });

  it("lists the tables the client actually writes", () => {
    // The paragraph names seven tables and enumerates them. Both halves were
    // hand-maintained: adding an eighth store to `api-client.ts` moves nothing
    // here, and the README is what a new reader trusts about what gets persisted.
    const folded = readme.replace(/\s+/g, " ");
    const m = /(\d+) tables \(`([^`]+)`\)/.exec(folded);
    expect(m, "the README no longer states the table count and list where this test reads it").not.toBeNull();
    const measured = writtenTables();
    expect(measured.length, "the derivation named no table at all").toBeGreaterThanOrEqual(7);
    const claimedList = (m?.[2] ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
      .sort();
    expect(claimedList, `README lists ${claimedList.join(", ")}, the client writes ${measured.join(", ")}`).toEqual(measured);
    expectClaim(m ? Number(m[1]) : null, measured.length, "table the client writes");
  });

  it("registers a version for every prompt it lists", () => {
    const missing = PROMPT_REGISTRY.filter((p) => !p.version || String(p.version).length === 0).map((p) => String(p.id));
    expect(missing, "an unversioned registration cannot be rolled back").toEqual([]);
  });
});
