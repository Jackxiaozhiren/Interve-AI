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
import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { PROMPT_REGISTRY } from "@/ai/prompts";
import { measureDebtRegex } from "../../scripts/audit-facts.mjs";

const readme = readFileSync(new URL("../../README.md", import.meta.url), "utf8");

/** The integer inside the parentheses that follow a phrase in the README. */
function claimedNumber(after: string): number | null {
  const at = readme.indexOf(after);
  if (at < 0) return null;
  const m = /\((\d+)[^)]*\)/.exec(readme.slice(at, at + 400));
  return m ? Number(m[1]) : null;
}

function generateObjectRoutes(): string[] {
  return sourceFiles("src/app/api").filter((rel) => /\bgenerateObject\s*\(/.test(text(rel)));
}

/** Every .ts/.tsx under `src/`, walked once for the readers below. */
function sourceFiles(dir = "src"): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(new URL(`../../${dir}`, import.meta.url))) {
    const rel = `${dir}/${entry}`;
    if (!entry.includes(".")) { out.push(...sourceFiles(rel)); continue; }
    if (/\.tsx?$/.test(entry)) out.push(rel);
  }
  return out;
}

const text = (rel: string) => readFileSync(new URL(`../../${rel}`, import.meta.url), "utf8");

/** Occurrences of a token across `src/`, counted the same way for both sides. */
function countInSrc(re: RegExp): number {
  return sourceFiles().reduce((n, rel) => n + (text(rel).match(re) ?? []).length, 0);
}

/** Files the collector's own debt regex matches — the ratchet's counting scope. */
function debtFiles(key: string): number {
  return sourceFiles().filter((rel) => measureDebtRegex(key, text(rel)) > 0).length;
}

/** How many prompt modules carry the untrusted-input fence. */
function fencedPromptFiles(): number {
  return readdirSync(new URL("../../src/ai/prompts", import.meta.url)).filter(
    (f) => f.endsWith(".ts") && /UNTRUSTED/.test(readFileSync(new URL(`../../src/ai/prompts/${f}`, import.meta.url), "utf8"))
  ).length;
}

describe("the README's architecture counts are the measured ones", () => {
  it("counts versioned prompts the way the registry counts them", () => {
    const claimed = claimedNumber("Versioned prompts `src/ai/prompts/`");
    expect(claimed, "the README no longer states the prompt count where this test reads it").not.toBeNull();
    expect(claimed, `README says ${claimed}, the registry holds ${PROMPT_REGISTRY.length}`).toBe(PROMPT_REGISTRY.length);
  });

  it("counts the routes still on generateObject rather than the call sites", () => {
    const claimed = claimedNumber("`generateObject` (");
    const measured = generateObjectRoutes().length;
    expect(claimed, "the README no longer states the route count where this test reads it").not.toBeNull();
    expect(claimed, `README says ${claimed}, ${measured} route files call generateObject`).toBe(measured);
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
    const claimed = claimedNumber("Untrusted resume/JD/answers are fenced as data");
    expect(claimed, "the README no longer states the fencing count where this test reads it").not.toBeNull();
    expect(claimed, `README says ${claimed}, ${fencedPromptFiles()} prompt files carry the fence`).toBe(fencedPromptFiles());
  });

  it("names how many files are still on the deprecated object APIs", () => {
    // This clause used to report what a third-party codemod would print, which
    // nothing here can observe. It now states the number a ratchet already bounds,
    // and is checked against both that ceiling and the collector's own regex.
    const m = /\b(\d+) files still call the deprecated object APIs\b/.exec(readme);
    const claimed = m ? Number(m[1]) : null;
    const measured = debtFiles("deprecatedObjectGenFiles");
    expect(claimed, "the README no longer states the deprecated-API count").not.toBeNull();
    expect(claimed, `README says ${claimed}, ${measured} files call generateObject/streamObject`).toBe(measured);
    const ceiling = JSON.parse(
      readFileSync(new URL("../../docs/audit/facts.limits.json", import.meta.url), "utf8")
    ).ceiling["debt.deprecatedObjectGenFiles"];
    expect(measured, "the README's number must be the ceiling it claims to name").toBe(ceiling);
  });

  it("registers a version for every prompt it lists", () => {
    const missing = PROMPT_REGISTRY.filter((p) => !p.version || String(p.version).length === 0).map((p) => String(p.id));
    expect(missing, "an unversioned registration cannot be rolled back").toEqual([]);
  });
});
