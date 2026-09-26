// V11 round-1 finding: `.env.example` is the documented setup path, and it was
// missing a key three routes cannot run without. parse-jd / analyze-alignment /
// analyze-code call google() — the @ai-sdk/google *default* provider, which
// reads GOOGLE_GENERATIVE_AI_API_KEY itself at call time (src/ never passes an
// explicit apiKey) — with no fallback model. Following the example file gave you
// three 500 UPSTREAM_ERROR routes while local dev looked healthy, because
// .env.local had the key the example never mentioned.
//
// The gate below is the durable half: names the code reads must be declared or
// deliberately excluded, and an exclusion that stops being read fails too.
// Limitation, stated so nobody trusts it further than it goes: an SDK that reads
// env internally is invisible here, so the one known implicit reader is pinned
// separately.
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";

const ROOT = fileURLToPath(new URL("../../", import.meta.url));

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.(ts|tsx)$/.test(full)) out.push(full);
  }
  return out;
}

const srcText = walk(join(ROOT, "src")).map((f) => readFileSync(f, "utf8")).join("\n");
const example = readFileSync(join(ROOT, ".env.example"), "utf8");

const readNames = [...new Set([...srcText.matchAll(/process\.env\.([A-Z][A-Z0-9_]*)/g)].map((m) => m[1]))].sort();
const declaredNames = [...example.matchAll(/^([A-Z][A-Z0-9_]*)=/gm)].map((m) => m[1]);

// Read by code, intentionally absent from the example file.
const EXCLUDED: Record<string, string> = {
  // Set by the runtime, never by an operator.
  NODE_ENV: "framework-provided, not operator config",
  // Dev/test switch for the mock provider lane; documented in README, and
  // defaulting it on from an example file would be a footgun.
  AI_MOCK: "dev-only override, off by default",
  // Per-user daily budget knob with a sane in-code default.
  USER_AI_BUDGET_RPD: "tuning knob, has a code default",
};

describe("env surface declared to whoever sets up the app", () => {
  it("every env name the code reads is declared or excluded with a reason", () => {
    const undocumented = readNames.filter(
      (n) => !declaredNames.includes(n) && !(n in EXCLUDED),
    );
    expect(undocumented, `add to .env.example (or justify excluding): ${undocumented.join(", ")}`).toEqual([]);
  });

  it("every exclusion is still a name the code reads", () => {
    const stale = Object.keys(EXCLUDED).filter((n) => !readNames.includes(n));
    expect(stale, `no longer read, drop from EXCLUDED: ${stale.join(", ")}`).toEqual([]);
  });

  // The implicit reader this whole file exists for: @ai-sdk/google's default
  // provider takes its key from env without src/ saying so.
  it("declares the key the Google default provider reads implicitly", () => {
    expect(readFileSync(join(ROOT, "src/ai/providers/registry.ts"), "utf8")).toMatch(
      /import \{ google as googleDefault \} from "@ai-sdk\/google"/,
    );
    expect(declaredNames).toContain("GOOGLE_GENERATIVE_AI_API_KEY");
  });
});
