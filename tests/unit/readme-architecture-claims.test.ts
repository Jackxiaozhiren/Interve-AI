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

const readme = readFileSync(new URL("../../README.md", import.meta.url), "utf8");

/** The integer inside the parentheses that follow a phrase in the README. */
function claimedNumber(after: string): number | null {
  const at = readme.indexOf(after);
  if (at < 0) return null;
  const m = /\((\d+)[^)]*\)/.exec(readme.slice(at, at + 400));
  return m ? Number(m[1]) : null;
}

function generateObjectRoutes(): string[] {
  const found: string[] = [];
  const walk = (dir: string) => {
    for (const entry of readdirSync(new URL(`../../${dir}`, import.meta.url))) {
      const rel = `${dir}/${entry}`;
      const url = new URL(`../../${rel}`, import.meta.url);
      if (entry.startsWith(".") || entry === "node_modules") continue;
      try {
        if (readdirSync(url).length && !entry.endsWith(".ts")) { walk(rel); continue; }
      } catch { /* a file, not a directory */ }
      if (entry.endsWith(".ts") && /\bgenerateObject\s*\(/.test(readFileSync(url, "utf8"))) found.push(rel);
    }
  };
  walk("src/app/api");
  return found;
}

/** Occurrences of a token across `src/`, counted the same way for both sides. */
function countInSrc(re: RegExp): number {
  let total = 0;
  const walk = (dir: string) => {
    for (const entry of readdirSync(new URL(`../../${dir}`, import.meta.url))) {
      const url = new URL(`../../${dir}/${entry}`, import.meta.url);
      if (!entry.includes(".")) { walk(`${dir}/${entry}`); continue; }
      if (!/\.tsx?$/.test(entry)) continue;
      total += (readFileSync(url, "utf8").match(re) ?? []).length;
    }
  };
  walk("src");
  return total;
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

  it("registers a version for every prompt it lists", () => {
    const missing = PROMPT_REGISTRY.filter((p) => !p.version || String(p.version).length === 0).map((p) => String(p.id));
    expect(missing, "an unversioned registration cannot be rolled back").toEqual([]);
  });
});
