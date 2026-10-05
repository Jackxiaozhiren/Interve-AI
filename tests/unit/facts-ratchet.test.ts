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
import {
  collectFacts,
  countHardInternalNavigations,
  evaluateRatchet,
  numericLeaves,
  RATCHET_KEYS,
  seedBlockers,
} from "../../scripts/audit-facts.mjs";

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

describe("path-pinned probes read what their names claim (V11 R-19)", () => {
  it("no probe reported a number from a file it never opened", () => {
    expect(facts.capabilities.probeBlindPaths).toEqual([]);
  });

  it("measures cancellation in the layer routes actually call", () => {
    // The bug this pins: `abortControllerInApiClient` read src/lib/api-client.ts,
    // which is a typed Supabase row shim and issues no HTTP. It reported "no
    // cancellation in the API client" — true, and about the wrong module, while
    // the shared guard every route funnels through had the AbortController all
    // along. Both halves are re-derived from disk so a probe cannot drift from
    // its own name without this failing.
    const guardFile = path.join(process.cwd(), "src/lib/api/guard.ts");
    expect(fs.existsSync(guardFile), "the request guard moved; repoint the probe").toBe(true);
    const constructed = (fs.readFileSync(guardFile, "utf8").match(/new AbortController/g) ?? []).length;
    expect(constructed).toBe(facts.capabilities.networkLayer.abortControllersInRequestGuard);
    expect(constructed).toBeGreaterThan(0);

    const apiDir = path.join(process.cwd(), "src/app/api");
    const adopters = fs
      .readdirSync(apiDir, { recursive: true })
      .filter((f): f is string => typeof f === "string" && f.endsWith(".ts"))
      .filter((f) => /from ["']@\/lib\/api\/guard["']/.test(fs.readFileSync(path.join(apiDir, f), "utf8")));
    expect(adopters.length).toBe(facts.capabilities.networkLayer.routesUsingRequestGuard);
    expect(adopters.length).toBeGreaterThan(0);
  });
  it("reports the longest source file as a line count, not a list length", () => {
    // Why this matters for the split in flight: numericLeaves maps an ARRAY to
    // its length, so `debt.longestSourceFiles` hands the ratchet the number 5 —
    // how many rows the probe prints, not how long anything is. A ceiling on it
    // would guard the size of the report while the files grew without bound.
    const srcDir = path.join(process.cwd(), "src");
    const walk = (dir: string): string[] =>
      fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
        const p = path.join(dir, e.name);
        return e.isDirectory() ? walk(p) : /\.(ts|tsx)$/.test(e.name) ? [p] : [];
      });
    const measured = walk(srcDir)
      .map((p) => fs.readFileSync(p, "utf8").split("\n").length)
      .sort((a, b) => b - a)[0];

    expect(facts.debt.longestSourceFileLines, "the probe must expose a scalar a ceiling can bind to").toBe(measured);
    // Same file both ways, or the two halves agree by accident.
    expect(facts.debt.longestSourceFiles[0].lines).toBe(measured);
    expect(measured).toBeGreaterThan(1000);
  });
});

describe("seed provenance (V11 R-18)", () => {
  it("accepts a clean tree", () => {
    expect(seedBlockers({ git: { dirty: [] } })).toEqual([]);
  });

  it("blocks on uncommitted edits", () => {
    expect(seedBlockers({ git: { dirty: [{ path: "src/a.ts", status: "M" }] } })).toEqual(["src/a.ts"]);
  });

  it("blocks on untracked files, which a CI checkout never contains", () => {
    const blockers = seedBlockers({ git: { dirty: [{ path: "docs/audit/NEW.md", status: "??" }] } });
    expect(blockers).toEqual(["docs/audit/NEW.md"]);
  });

  it("survives the shapes collectFacts actually emits", () => {
    expect(seedBlockers(undefined)).toEqual([]);
    expect(seedBlockers({})).toEqual([]);
    expect(seedBlockers({ git: {} })).toEqual([]);
    expect(seedBlockers(facts)).toEqual(facts.git.dirty.map((entry) => entry.path));
  });
});

/**
 * The hard-navigation metric decides on the parse tree, so prose about a
 * navigation is not a navigation. The regex version it replaced counted the
 * adjudication comment itself, which is how a ratchet ends up teaching people
 * to reword documentation instead of code.
 */
describe("countHardInternalNavigations", () => {
  const cases: [string, string, number][] = [
    ["assignment through window", 'window.location.href = "/dashboard";', 1],
    ["bare location.assign", 'location.assign("/dashboard");', 1],
    ["document.location.replace", 'document.location.replace("/x");', 1],
    ["handler inside JSX", 'const B = () => (<button onClick={() => (window.location.href = "/setup")} />);', 1],
    ["named in a line comment", '// window.location.href = "/dashboard"\nconst a = 1;', 0],
    ["named in a block comment", '/* location.assign("/x") */\nconst a = 1;', 0],
    ["reading href is not a navigation", "const here = window.location.href;", 0],
    ["another object's location field", 'state.location.assign("/x"); "abc".replace("a", "b");', 0],
  ];
  it.each(cases)("counts %s", (_label, body, expected) => {
    expect(countHardInternalNavigations(body, "probe.tsx")).toBe(expected);
  });

  it("finds the one adjudicated case, and only there", () => {
    // The ceiling says 1. This says which file owns it, so deleting the
    // settlement reload cannot be paid for by adding one somewhere else.
    expect(facts.debt.hardInternalNavigations).toBe(1);
    for (const [file, expected] of [
      ["src/components/interview/useInterviewSettlement.ts", 1],
      ["src/app/error.tsx", 0],
      ["src/components/dashboard/SessionDetailModal.tsx", 0],
    ] as [string, number][]) {
      const body = fs.readFileSync(path.join(process.cwd(), file), "utf8");
      expect(countHardInternalNavigations(body, file), file).toBe(expected);
    }
  });
});
