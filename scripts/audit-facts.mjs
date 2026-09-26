// audit-facts.mjs — V11 Phase 0: derive the audit baseline instead of hand-writing it.
//
// Why: the ten previous master prompts each baked HEAD shas, dependency
// versions, test counts and dirty-tree sizes into prose. Every one of them was
// wrong within a day, and an executor that trusts a stale number anchors on it
// instead of measuring. This script is the single place those facts may live.
// Nothing here is allowed to be quoted from memory — `--check` re-derives it.
//
// Design: zero dependencies, zero network, zero keyed calls, never writes
// source. Exit code is the product: `--check` exits 1 when a ceiling ratchet is
// crossed, so CI — not a human re-running greps — owns the debt ledger.
//
// CLI:
//   node scripts/audit-facts.mjs            # JSON to stdout
//   node scripts/audit-facts.mjs --write    # + docs/audit/facts.baseline.json
//   node scripts/audit-facts.mjs --seed     # + docs/audit/facts.limits.json (ceilings at today's value)
//   node scripts/audit-facts.mjs --force    # with --seed: allow a dirty tree, at the cost above
//   node scripts/audit-facts.mjs --check    # exit 1 on any ratchet violation

import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const BASELINE = path.join(ROOT, "docs/audit/facts.baseline.json");
const LIMITS = path.join(ROOT, "docs/audit/facts.limits.json");

const DAY_MS = 86_400_000;

/** Paths a probe tried to open and could not. Surfaced as a fact, not a warning. */
const probeBlindPaths = new Set();

function git(args) {
  try {
    return execFileSync("git", args, { cwd: ROOT, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
  } catch {
    return null;
  }
}

function readText(rel) {
  try {
    return fs.readFileSync(path.join(ROOT, rel), "utf8");
  } catch {
    // A probe that silently reads "" is worse than one that errors: it reports a
    // confident zero about code it never opened. Recorded so a test can fail on it.
    probeBlindPaths.add(rel);
    return null;
  }
}

function readJson(rel) {
  const raw = readText(rel);
  if (raw === null) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function walk(abs, out = []) {
  for (const entry of fs.readdirSync(abs, { withFileTypes: true })) {
    const full = path.join(abs, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (/\.(ts|tsx)$/.test(entry.name)) out.push(full);
  }
  return out;
}

function sourceFiles() {
  const src = path.join(ROOT, "src");
  return fs.existsSync(src) ? walk(src) : [];
}

/** Count regex matches across src/, optionally capped to one hit per file. */
function countHits(re, { perFile = false } = {}) {
  let total = 0;
  for (const file of sourceFiles()) {
    const body = fs.readFileSync(file, "utf8");
    const matches = body.match(re);
    if (!matches) continue;
    total += perFile ? 1 : matches.length;
  }
  return total;
}

function fileCountHit(re) {
  return countHits(re, { perFile: true });
}

/** How many source files match — the adoption half of "is this layer real?". */
function fileCountMatching(re) {
  return sourceFiles().filter((f) => re.test(fs.readFileSync(f, "utf8"))).length;
}

function collectGit() {
  const porcelain = git(["status", "--porcelain"]) ?? "";
  const dirty = porcelain
    .split("\n")
    .filter(Boolean)
    .map((line) => {
      const status = line.slice(0, 2).trim();
      const file = line.slice(2).trim();
      const sha = git(["log", "-1", "--format=%H|%aI", "--", file]);
      if (!sha) return { path: file, status, lastTouch: null, ageDays: null };
      const [shaOnly, when] = sha.split("|");
      const ts = Date.parse(when);
      return {
        path: file,
        status,
        lastTouch: shaOnly.slice(0, 7),
        ageDays: Number.isNaN(ts) ? null : Math.max(0, Math.round((Date.now() - ts) / DAY_MS)),
      };
    });
  return {
    head: git(["rev-parse", "--short", "HEAD"]),
    branch: git(["branch", "--show-current"]),
    aheadBehind: git(["rev-list", "--left-right", "--count", "@{upstream}...HEAD"]) ?? "",
    dirty,
  };
}

/** Installed versions come from node_modules, never from package.json ranges. */
function collectRuntime() {
  const pkg = readJson("package.json") ?? {};
  const installed = (name) => readJson(path.join("node_modules", name, "package.json"))?.version ?? null;
  const docker = readText("Dockerfile") ?? "";
  return {
    node: process.version,
    declaredEngines: pkg.engines?.node ?? null,
    dockerNodeBase: docker.match(/node:[0-9][0-9a-zA-Z.-]*/)?.[0] ?? null,
    installed: {
      next: installed("next"),
      react: installed("react"),
      ai: installed("ai"),
      aiSdkReact: installed("@ai-sdk/react"),
      typescript: installed("typescript"),
      vitest: installed("vitest"),
    },
  };
}

function collectDebt() {
  const files = sourceFiles();
  const withLines = files
    .map((f) => ({ path: path.relative(ROOT, f), lines: fs.readFileSync(f, "utf8").split("\n").length }))
    .sort((a, b) => b.lines - a.lines)
    .slice(0, 5);
  const auditDir = path.join(ROOT, "docs/audit");
  const auditDocsLines = fs.existsSync(auditDir)
    ? fs
        .readdirSync(auditDir)
        .filter((f) => f.endsWith(".md"))
        .reduce((sum, f) => sum + fs.readFileSync(path.join(auditDir, f), "utf8").split("\n").length, 0)
    : 0;
  return {
    deprecatedObjectGenFiles: fileCountHit(/\b(?:generateObject|streamObject)\b/),
    experimentalRepairTextHits: countHits(/\bexperimental_repairText\b/g),
    selectStarHits: countHits(/\bselect\(\s*['"]\*['"]\s*\)/g),
    tsIgnoreHits: countHits(/@ts-(?:ignore|expect-error)/g),
    todoMarkers: countHits(/\b(?:TODO|FIXME|HACK|XXX)\b/g),
    anyEscapes: countHits(/:\s*any\b|\bas any\b|<any>/g),
    longestSourceFiles: withLines,
    auditDocsLines,
  };
}

/**
 * Capability probes: mechanical signals only. Each `warnings` entry is a
 * deterministic contradiction between two measured facts — the audit axes
 * reason about them, the script never parses prose to guess.
 */
function collectCapabilities() {
  const pkg = readJson("package.json") ?? {};
  const scripts = pkg.scripts ?? {};
  const config = readText("next.config.ts") ?? "";
  const manifest = readJson("public/manifest.json");
  const swFiles = fs.existsSync(path.join(ROOT, "public"))
    ? fs.readdirSync(path.join(ROOT, "public")).filter((f) => /^(sw|workbox).*\.js$/.test(f))
    : [];
  const appDir = path.join(ROOT, "src/app");
  const appFiles = fs.existsSync(appDir) ? walk(appDir) : [];
  const nameOf = (f) => path.basename(f);
  const pages = appFiles.filter((f) => nameOf(f) === "page.tsx");
  const clientFiles = sourceFiles().filter((f) => /^\s*["']use client["']/.test(fs.readFileSync(f, "utf8")));

  // Callback shapes handed to a third-party chat hook, cross-checked against
  // test references. A callback that no test names cannot regress loudly —
  // which is exactly how a v6->v7 signature change survived a green `verify`.
  const CALLBACKS = ["onFinish", "onEnd", "onError", "onData", "onToolCallStatus", "onChunk"];
  const testsDir = path.join(ROOT, "tests");
  const testBody = fs.existsSync(testsDir)
    ? walk(testsDir)
        .map((f) => { try { return fs.readFileSync(f, "utf8"); } catch { return ""; } })
        .join("\n")
    : "";
  const untestedCallbacks = CALLBACKS.filter((name) => {
    const usedInSrc = sourceFiles().some((f) => new RegExp(`\\b${name}\\s*[:(]`).test(fs.readFileSync(f, "utf8")));
    return usedInSrc && !new RegExp(`\\b${name}\\b`).test(testBody);
  });

  const warnings = [];
  if (pkg.dependencies?.["next-pwa"] || pkg.devDependencies?.["next-pwa"] || /next-pwa/.test(config)) {
    if (swFiles.length === 0) warnings.push("pwa_plugin_declares_offline_but_no_service_worker_emitted");
  }
  if (/^\s*webpack\s*:/m.test(config) && !/--webpack/.test(`${scripts.dev ?? ""} ${scripts.build ?? ""}`)) {
    warnings.push("webpack_config_block_present_but_build_scripts_do_not_select_webpack");
  }
  if (manifest?.display && swFiles.length === 0) {
    warnings.push("manifest_declares_standalone_display_without_service_worker");
  }

  return {
    pwa: { serviceWorkerFiles: swFiles.length, manifestDisplay: manifest?.display ?? null, manifestStartUrl: manifest?.start_url ?? null },
    bundler: {
      devScript: scripts.dev ?? null,
      buildScript: scripts.build ?? null,
      webpackFlagInScripts: /--webpack/.test(`${scripts.dev ?? ""} ${scripts.build ?? ""}`),
      webpackConfigBlock: /^\s*webpack\s*:/m.test(config),
      turbopackConfigBlock: /^\s*turbopack\s*:/m.test(config),
    },
    cache: {
      cacheComponentsFlag: /cacheComponents/.test(config),
      useCacheDirective: countHits(/\buse cache\b/g),
      cacheTagCalls: countHits(/\b(?:cacheTag|cacheLife|revalidateTag|updateTag)\b/g),
    },
    boundaries: {
      pages: pages.length,
      dynamicSegmentPages: pages.filter((f) => /\[[^\]]+\]/.test(f)).length,
      errorFiles: appFiles.filter((f) => nameOf(f) === "error.tsx").length,
      loadingFiles: appFiles.filter((f) => nameOf(f) === "loading.tsx").length,
      globalErrorFiles: appFiles.filter((f) => nameOf(f) === "global-error.tsx").length,
    },
    networkLayer: {
      // Cancellation lives in the shared request guard that routes funnel
      // through, not in `src/lib/api-client.ts` — that file is a typed Supabase
      // row shim and issues no HTTP. Pointing here at it reported "no
      // cancellation in the API client": literally true, and about the wrong file.
      abortControllersInRequestGuard: (readText("src/lib/api/guard.ts") ?? "").match(/new AbortController/g)?.length ?? 0,
      routesUsingRequestGuard: fileCountMatching(/from ["']@\/lib\/api\/guard["']/),
      rawFetchCalls: countHits(/\bfetch\(/g),
      clientComponentFiles: clientFiles.length,
    },
    probeBlindPaths: [...probeBlindPaths].sort(),
    untestedChatCallbacks: untestedCallbacks,
    warnings,
  };
}

export function collectFacts() {
  const gitInfo = collectGit();
  return {
    generatedAt: new Date().toISOString(),
    git: gitInfo,
    runtime: collectRuntime(),
    debt: collectDebt(),
    capabilities: collectCapabilities(),
    meta: { dirtyEntries: gitInfo.dirty.length, sourceFiles: sourceFiles().length },
  };
}

/**
 * Keys allowed to carry a ceiling, and what each one guards. Deliberately an
 * explicit list: prefix-matching once tried to ratchet `longestSourceFiles`
 * (an array length) and `sourceFiles` (adding code is not debt).
 *
 * Not ratcheted even though measured: `meta.dirtyEntries`. The CI checkout tree
 * is always clean, so a ceiling there could never fire in the pipeline it is
 * meant to protect — it would only flash red mid-work locally. Uncommitted
 * work is priced by the adjudication gate instead, not by CI.
 */
export const RATCHET_KEYS = {
  "debt.deprecatedObjectGenFiles": "call sites on @deprecated AI SDK object APIs",
  "debt.experimentalRepairTextHits": "deprecated experimental_repairText aliases",
  "debt.selectStarHits": "SELECT '*' — pulls columns past the field allowlist",
  "debt.tsIgnoreHits": "type-check suppressions",
  "debt.todoMarkers": "TODO/FIXME/HACK/XXX left behind",
  "debt.anyEscapes": "explicit `any` escaping the strict config",
  "debt.auditDocsLines": "docs/audit prose volume — the audit apparatus must not outgrow the product",
  "capabilities.untestedChatCallbacks": "cross-version callbacks with no test naming them",
  "capabilities.networkLayer.rawFetchCalls": "raw fetch() bypassing the shared client (no timeout/cancel)",
};

/**
 * Paths that make a seed unreproducible, because CI enforces the ceilings
 * against a checkout it builds from a commit — never against this directory.
 *
 * Ceilings seeded from uncommitted work record debt the repository does not
 * have: main then fails its own gate while the author's machine stays green.
 * That is exactly how the first `facts:check` run went red, so seeding from a
 * dirty tree is refused rather than warned about.
 *
 * @param {unknown} facts
 * @returns {string[]}
 */
export function seedBlockers(facts) {
  const dirty = /** @type {{git?: {dirty?: {path?: unknown}[]}}} */ (facts ?? {})?.git?.dirty;
  if (!Array.isArray(dirty)) return [];
  return dirty.map((entry) => String(entry?.path ?? entry));
}

/**
 * Flatten to dotted numeric keys so the ratchet config stays a flat map.
 *
 * Typed via JSDoc rather than only the sibling .d.ts: `allowJs` is on, so tsc
 * infers from this implementation, and a bare `out = {}` default widens the
 * result to `{}` and makes every lookup an implicit any.
 *
 * @param {unknown} obj
 * @param {string} [prefix]
 * @param {Record<string, number>} [out]
 * @returns {Record<string, number>}
 */
export function numericLeaves(obj, prefix = "", out = {}) {
  for (const [key, value] of Object.entries(obj)) {
    const dot = prefix ? `${prefix}.${key}` : key;
    if (typeof value === "number") out[dot] = value;
    else if (Array.isArray(value)) out[dot] = value.length;
    else if (value && typeof value === "object") numericLeaves(value, dot, out);
  }
  return out;
}

/**
 * `limits` = { ceiling: {key: max}, floor: {key: min} }. Ceiling keys reject an
 * increase, floor keys reject a decrease. Unknown keys are reported so a stale
 * ledger cannot silently stop guarding anything.
 */
export function evaluateRatchet(facts, limits) {
  const leaves = numericLeaves(facts);
  const violations = [];
  for (const [key, max] of Object.entries(limits?.ceiling ?? {})) {
    if (!(key in leaves)) { violations.push({ key, kind: "ceiling", problem: "key_no_longer_measured", actual: null, limit: max }); continue; }
    if (leaves[key] > max) violations.push({ key, kind: "ceiling", actual: leaves[key], limit: max, problem: "debt_grew" });
  }
  for (const [key, min] of Object.entries(limits?.floor ?? {})) {
    if (!(key in leaves)) { violations.push({ key, kind: "floor", problem: "key_no_longer_measured", actual: null, limit: min }); continue; }
    if (leaves[key] < min) violations.push({ key, kind: "floor", actual: leaves[key], limit: min, problem: "guard_shrank" });
  }
  return { violations, leaves };
}

function main() {
  const args = process.argv.slice(2);
  const facts = collectFacts();

  if (args.includes("--seed")) {
    const blockers = seedBlockers(facts);
    if (blockers.length > 0 && !args.includes("--force")) {
      process.stderr.write(
        `seed refused: ${blockers.length} uncommitted entr${blockers.length === 1 ? "y" : "ies"} — ` +
          `a ceiling taken from this tree is not one CI can reproduce.\n` +
          blockers.map((b) => `  ${b}`).join("\n") +
          `\nCommit or set the tree aside first, or pass --force to seed anyway.\n`,
      );
      process.exit(1);
    }
    fs.mkdirSync(path.dirname(LIMITS), { recursive: true });
    const leaves = numericLeaves(facts);
    const ceiling = {};
    for (const key of Object.keys(RATCHET_KEYS)) {
      if (typeof leaves[key] !== "number") {
        process.stderr.write(`seed: ${key} is not measured (got ${String(leaves[key])}) — check RATCHET_KEYS\n`);
        process.exit(1);
      }
      ceiling[key] = leaves[key];
    }
    fs.writeFileSync(LIMITS, `${JSON.stringify({ _seededAt: facts.generatedAt, _keys: RATCHET_KEYS, ceiling, floor: {} }, null, 2)}\n`);
    process.stdout.write(`seeded ${Object.keys(ceiling).length} ceiling keys -> ${path.relative(ROOT, LIMITS)}\n`);
    return;
  }

  if (args.includes("--check")) {
    const limits = readJson(path.relative(ROOT, LIMITS));
    if (!limits) {
      process.stderr.write("facts.limits.json missing — run `npm run facts:seed` first\n");
      process.exit(1);
    }
    const { violations } = evaluateRatchet(facts, limits);
    if (violations.length === 0) {
      process.stdout.write("facts ratchet: OK\n");
      return;
    }
    process.stderr.write(`facts ratchet: ${violations.length} violation(s)\n`);
    for (const v of violations) {
      process.stderr.write(`  ${v.kind} ${v.key}: actual=${String(v.actual)} limit=${String(v.limit)} (${v.problem})\n`);
    }
    process.exit(1);
  }

  const json = `${JSON.stringify(facts, null, 2)}\n`;
  if (args.includes("--write")) {
    fs.mkdirSync(path.dirname(BASELINE), { recursive: true });
    fs.writeFileSync(BASELINE, json);
    process.stdout.write(`wrote ${path.relative(ROOT, BASELINE)}\n`);
  }
  process.stdout.write(json);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
