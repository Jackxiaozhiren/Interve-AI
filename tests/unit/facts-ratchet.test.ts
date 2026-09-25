// V11 R-16 / Ring B: the debt ratchet is enforced by CI, not by a human
// re-running greps each audit round. Ten master prompts documented baselines in
// prose and every one of them went stale within a day; this test makes a stale
// baseline structurally impossible by re-deriving it on every `npm run verify`.
//
// Two failure modes matter and are both covered:
//   1. debt grew            -> a ceiling key exceeds its limit
//   2. a guard went blind   -> a ratchet key stopped being measured (renamed or
//      deleted probe), which would otherwise leave the ledger quietly guarding
//      nothing at all.
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { collectFacts, evaluateRatchet, numericLeaves, RATCHET_KEYS } from "../../scripts/audit-facts.mjs";

const LIMITS_FILE = path.join(process.cwd(), "docs/audit/facts.limits.json");
const facts = collectFacts();
const limits = fs.existsSync(LIMITS_FILE) ? JSON.parse(fs.readFileSync(LIMITS_FILE, "utf8")) : null;

describe("audit-facts baseline derivation (V11 Phase 0)", () => {
  it("reads installed versions from node_modules, not from declared ranges", () => {
    expect(facts.runtime.installed.next).toMatch(/^\d+\.\d+\.\d+/);
    expect(facts.runtime.installed.ai).toMatch(/^\d+\.\d+\.\d+/);
    expect(facts.runtime.installed.react).toMatch(/^\d+\.\d+\.\d+/);
  });

  it("resolves tree position from git rather than memory", () => {
    expect(facts.git.head).toMatch(/^[0-9a-f]{7,}$/);
    expect(Array.isArray(facts.git.dirty)).toBe(true);
    expect(facts.meta.dirtyEntries).toBe(facts.git.dirty.length);
  });

  it("attributes every dirty entry to a last touch, or null when untracked", () => {
    for (const entry of facts.git.dirty) {
      if (entry.status.includes("?")) {
        expect(entry.lastTouch).toBeNull();
      } else {
        expect(entry.lastTouch).toMatch(/^[0-9a-f]{7}$/);
        expect(entry.ageDays).toBeTypeOf("number");
      }
    }
  });
});

describe("ratchet ledger integrity", () => {
  it("exists and declares a limit for every ratchet-eligible key", () => {
    expect(limits, "run `npm run facts:seed` to create docs/audit/facts.limits.json").toBeTruthy();
    for (const key of Object.keys(RATCHET_KEYS)) {
      expect(limits.ceiling, `missing ceiling for ${key}`).toHaveProperty(key);
    }
  });

  it("never ratchets a key the collector stopped measuring", () => {
    const leaves = numericLeaves(facts);
    for (const key of Object.keys(RATCHET_KEYS)) {
      expect(typeof leaves[key], `${key} is declared but not measured`).toBe("number");
    }
  });
});

describe("debt ratchet (Ring B)", () => {
  it("no ceiling is exceeded — debt may only shrink", () => {
    const { violations } = evaluateRatchet(facts, limits);
    expect(
      violations,
      `ratchet violations:\n${violations.map((v) => `  ${v.kind} ${v.key}: actual=${v.actual} limit=${v.limit} (${v.problem})`).join("\n")}`,
    ).toEqual([]);
  });
});

describe("capability contradiction probes", () => {
  it("flags a callback used in src that no test names", () => {
    // The probe that earned its keep: a v6->v7 chat callback change survived a
    // green `verify` because nothing tested it. Re-derive the test-absence half
    // independently so the probe cannot silently start reporting nothing.
    const testsDir = path.join(process.cwd(), "tests");
    const corpus = fs
      .readdirSync(testsDir, { recursive: true })
      .filter((f): f is string => typeof f === "string" && f.endsWith(".ts"))
      .map((f) => fs.readFileSync(path.join(testsDir, f), "utf8"))
      .join("\n");
    for (const name of facts.capabilities.untestedChatCallbacks) {
      expect(name).toMatch(/^on[A-Z]/);
      expect(corpus).not.toContain(name);
    }
  });

  it("keeps warnings coupled to the facts that produced them", () => {
    const { warnings, pwa, bundler } = facts.capabilities;
    if (warnings.includes("manifest_declares_standalone_display_without_service_worker")) {
      expect(pwa.serviceWorkerFiles).toBe(0);
      expect(pwa.manifestDisplay).toBeTruthy();
    }
    if (warnings.includes("webpack_config_block_present_but_build_scripts_do_not_select_webpack")) {
      expect(bundler.webpackConfigBlock).toBe(true);
      expect(bundler.webpackFlagInScripts).toBe(false);
    }
  });
});
