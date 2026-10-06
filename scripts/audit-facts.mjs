// audit-facts.mjs — V11 Phase 0: derive the audit baseline instead of hand-writing it.
//
// Why: the ten previous master prompts each baked HEAD shas, dependency
// versions, test counts and dirty-tree sizes into prose. Every one of them was
// wrong within a day, and an executor that trusts a stale number anchors on it
// instead of measuring. This script is the single place those facts may live.
// Nothing here is allowed to be quoted from memory — `--check` re-derives it.
//
// Design: zero network, zero keyed calls, never writes source. Exit code is the
// product: `--check` exits 1 when a ceiling ratchet is crossed, so CI — not a
// human re-running greps — owns the debt ledger. The one module it imports is
// the workspace's own `typescript` (already required by `npm run typecheck`),
// used to parse call sites properly rather than grep text: a doc comment that
// mentions `fetch(` otherwise reports debt the repository does not have.
//
// Known blind spot, stated rather than discovered later: rawFetchCalls counts
// literal `fetch(` call expressions. Wrapping a call behind an injected
// `fetchImpl` parameter hides it, so the number falls when call sites become
// managed and testable — which is the right direction, but it is not a measure
// of how much the browser fetches. Read a decrease as "fewer unmanaged call
// sites"; a decrease alone is never evidence that a network call disappeared.
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
import ts from "typescript";

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

/**
 * Count `fetch(...)` call sites in one source text, by parse tree.
 *
 * Replaces /\bfetch\(/g over raw file text. That scanner could not tell a call
 * from a mention: the day a doc comment described "the fetch(...) chains" being
 * lifted out of the interview page, the ratchet reported 18 where 17 were real.
 * Indirect forms (`window.fetch(`) still count, so the ceiling cannot be
 * relaxed by the rewrite — only prose stops moving the number.
 */
export function countRawFetchCallSites(sourceText, fileName) {
  const sourceFile = ts.createSourceFile(
    fileName,
    sourceText,
    ts.ScriptTarget.Latest,
    /* setParentNodes */ true,
    fileName.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS
  );
  let hits = 0;
  const visit = (node) => {
    if (ts.isCallExpression(node)) {
      const callee = node.expression;
      const name = ts.isIdentifier(callee)
        ? callee.escapedText
        : ts.isPropertyAccessExpression(callee)
          ? callee.name.escapedText
          : null;
      if (name === "fetch") hits += 1;
    }
    ts.forEachChild(node, visit);
  };
  ts.forEachChild(sourceFile, visit);
  return hits;
}

function countRawFetchCallSitesInSrc() {
  let total = 0;
  for (const file of sourceFiles()) {
    total += countRawFetchCallSites(fs.readFileSync(file, "utf8"), file);
  }
  return total;
}

/**
 * Count explicit `any` type positions in one source text, by parse tree.
 *
 * Same defect class as the fetch counter this file used to carry: /\s*any\b
 * over raw text cannot tell a type annotation from a sentence, and the first
 * comment that said "…at all: any error response fell into" reported one escape
 * where the strict config has none. `SyntaxKind.AnyKeyword` is the thing measured
 * — it covers `: any`, `as any`, `Array<any>`, `Record<string, any>` and
 * `any[]`, including the nested forms the old regex never saw.
 */
export function countAnyEscapes(sourceText, fileName) {
  const sourceFile = ts.createSourceFile(
    fileName,
    sourceText,
    ts.ScriptTarget.Latest,
    /* setParentNodes */ true,
    fileName.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS
  );
  let hits = 0;
  const visit = (node) => {
    if (node.kind === ts.SyntaxKind.AnyKeyword) hits += 1;
    ts.forEachChild(node, visit);
  };
  ts.forEachChild(sourceFile, visit);
  return hits;
}

/**
 * Whole-document navigations to an app route, measured on the parse tree.
 *
 * The first version counted a regex over raw text, which cannot tell code from
 * prose about code — so the very comment that adjudicates the surviving case
 * would have raised the debt number itself, inviting a future reader to reword
 * the comment rather than the navigation. Only an assignment to, or a call on,
 * a global `location` object counts; reading `location.href` does not.
 */
export function countHardInternalNavigations(sourceText, fileName) {
  const sourceFile = ts.createSourceFile(
    fileName,
    sourceText,
    ts.ScriptTarget.Latest,
    /* setParentNodes */ true,
    fileName.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS
  );
  const isGlobalLocation = (node) => {
    if (ts.isPropertyAccessExpression(node)) {
      const base = node.expression;
      return (
        ts.isIdentifier(node.name) &&
        node.name.text === "location" &&
        ts.isIdentifier(base) &&
        ["window", "document", "globalThis"].includes(base.text)
      );
    }
    return ts.isIdentifier(node) && node.text === "location";
  };
  let hits = 0;
  const visit = (node) => {
    if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.EqualsToken) {
      const left = node.left;
      if (
        ts.isPropertyAccessExpression(left) &&
        left.name.text === "href" &&
        isGlobalLocation(left.expression)
      ) {
        hits += 1;
      }
    }
    if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)) {
      const name = node.expression.name.text;
      if ((name === "assign" || name === "replace") && isGlobalLocation(node.expression.expression)) {
        hits += 1;
      }
    }
    ts.forEachChild(node, visit);
  };
  ts.forEachChild(sourceFile, visit);
  return hits;
}

function countHardInternalNavigationsInSrc() {
  let total = 0;
  for (const file of sourceFiles()) {
    total += countHardInternalNavigations(fs.readFileSync(file, "utf8"), file);
  }
  return total;
}

function countAnyEscapesInSrc() {
  let total = 0;
  for (const file of sourceFiles()) {
    total += countAnyEscapes(fs.readFileSync(file, "utf8"), file);
  }
  return total;
}

/**
 * Parse `git status --porcelain -z` into records.
 *
 * The non-z form was the bug this replaces: a rename prints `RM new -> old` on
 * one line, so slicing the tail produced the literal string "a.ts -> b.ts" as a
 * pathspec, `git log` matched no commit, and every renamed file silently lost
 * its lastTouch attribution. -z fixes two things at once — NUL-separated records
 * are never line-wrapped, and the source path arrives as its own field.
 */
export function parseStatusEntries(porcelainZ) {
  const fields = String(porcelainZ ?? "")
    .split("\0")
    .filter((field) => field !== "");
  const rows = [];
  for (let i = 0; i < fields.length; i += 1) {
    const record = fields[i];
    const status = record.slice(0, 2).trim();
    const path = record.slice(3);
    // Renames and copies carry the source path in the following record.
    if (/^[RC]/.test(status)) {
      rows.push({ status, path, renamedFrom: fields[++i] });
    } else {
      rows.push({ status, path });
    }
  }
  return rows;
}

/**
 * Status text must NOT go through git(): that helper trims, and a porcelain
 * record starts with a space whenever the index column is clean, so trimming
 * shifts every path in the first record by one character.
 */
export function gitStatusZ() {
  try {
    return execFileSync("git", ["status", "--porcelain", "-z"], {
      cwd: ROOT,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    });
  } catch {
    return "";
  }
}

function collectGit() {
  const entries = parseStatusEntries(gitStatusZ());
  const dirty = entries.map(({ status, path: file, renamedFrom }) => {
    // Follow a rename back to its source: the destination path has no history
    // yet, so attributing only the destination would report a brand-new last
    // touch for a file that may be years old.
    const probe = (p) => git(["log", "-1", "--format=%H|%aI", "--", p]);
    const sha = probe(file) || (renamedFrom ? probe(renamedFrom) : "");
    // `renamedFrom` travels with the record on purpose: "this path has no commit yet"
    // is a fact a consumer has to be able to check independently, and without it a
    // rename looks like a history-less entry to anything downstream.
    if (!sha) return { path: file, status, renamedFrom: renamedFrom ?? null, lastTouch: null, ageDays: null };
      const [shaOnly, when] = sha.split("|");
      const ts = Date.parse(when);
      return {
        path: file,
        status,
        renamedFrom: renamedFrom ?? null,
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

/**
 * A production dependency that no tracked source file imports is a claim in the
 * shipped manifest that the code does not back: it survives `npm audit --omit=dev`,
 * it is installed into every deploy, and it tells the next auditor the app has a
 * capability it does not have.
 *
 * The corpus is `src/**` in .ts/.tsx **and** .css, and both import forms count.
 * `.css` is not decoration: `@import "tw-animate-css"` is the only place that
 * package is used, and a specifier-only scan files it as dead. Dynamic
 * `import("canvas-confetti")` counts for the same reason — the settlement confetti
 * is lazily loaded on purpose.
 */
// One line per specifier. `[^"']+` without the newline ban matched a quote pair that
  // straddled several statements, and every junk "package name" it produced then made
  // a real `readFileSync` fail below — the existing probe-blindness invariant caught it
  // on the first run, which is exactly why that invariant exists.
const MODULE_SPECIFIER_RE =
  /(?:from|require)\s*\(?\s*["']([^"'\n]+)["']|import\s*\(\s*["']([^"'\n]+)["']|@import\s+(?:url\()?["']([^"'\n]+)["']/g;

const packageRoot = (specifier) =>
  specifier.startsWith("@")
    ? specifier.split("/").slice(0, 2).join("/")
    : specifier.split("/")[0];

/**
 * @param {string[]} dependencies the `dependencies` keys of package.json
 * @param {string[]} specifiers every module specifier found in `src/`
 * @param {(name: string) => string[]} [peersOf] peer requirements of an installed
 *        package; typed here because the strict TS config reads this JS module's
 *        signature off its defaults, and a bare `() => []` default narrowed the
 *        parameter to `() => never[]` and failed the typecheck of the test that
 *        passes a real function.
 */
export function findUnreferencedProductionDeps(dependencies, specifiers, peersOf = () => []) {
  const roots = new Set(specifiers.map(packageRoot));
  // A framework pulls its own runtime in by peer dependency rather than by an import
  // statement in this repo: `next` declares react and react-dom, and neither appears in
  // a source file. Treating "no src/ import" as the whole test flagged `react-dom` as
  // dead weight, which is the kind of false positive that teaches people to distrust a
  // ratchet, so the referenced set is closed over the peer requirements of what is used.
  for (const name of [...roots]) for (const peer of peersOf(name)) roots.add(packageRoot(peer));
  return dependencies.filter((name) => !roots.has(packageRoot(name)));
}

/**
 * Peer requirements of an installed package, or nothing at all when it is not a
 * package: `@/lib/db` and `./x` are this repo's own specifiers, and a missing
 * manifest here is the correct answer, not a probe that read nothing — so it goes
 * through a local read rather than `readJson`, which records every failure as a
 * blind path.
 */
function installedPeerDependencies(name) {
  if (name.startsWith("@/") || name.startsWith(".") || name.startsWith("/")) return [];
  try {
    const manifest = JSON.parse(
      fs.readFileSync(path.join(ROOT, "node_modules", name, "package.json"), "utf8"),
    );
    return Object.keys(manifest.peerDependencies ?? {});
  } catch {
    return [];
  }
}

function importedSpecifiersInSrc() {
  const src = path.join(ROOT, "src");
  if (!fs.existsSync(src)) return [];
  const files = [];
  const walkAll = (abs) => {
    for (const entry of fs.readdirSync(abs, { withFileTypes: true })) {
      const full = path.join(abs, entry.name);
      if (entry.isDirectory()) walkAll(full);
      else if (/\.(ts|tsx|css)$/.test(entry.name)) files.push(full);
    }
  };
  walkAll(src);
  const found = [];
  for (const f of files) {
    for (const m of fs.readFileSync(f, "utf8").matchAll(MODULE_SPECIFIER_RE)) {
      const spec = m[1] ?? m[2] ?? m[3] ?? "";
      if (spec) found.push(spec);
    }
  }
  return found;
}

/**
 * Clickable elements that no keyboard event reaches, counted on the parse tree.
 *
 * Why an AST and not the two eslint rules this stands in for: enabling
 * `click-events-have-key-events` and `no-static-element-interactions` today would
 * fail CI on 11 pre-existing errors, and a permanently-red gate is not a gate — the
 * config comment that defers them says so out loud. This counts the same defect so a
 * *new* one goes red immediately, while the ceiling can only move down.
 *
 * Comment-blind by construction: prose about a click handler is not a JSX element, so
 * the note that adjudicates this debt cannot raise its own number.
 *
 * The class is real, not theoretical: `jsx-a11y/click-events-have-key-events` caught
 * the setup wizard's resume dropzone (`<div onClick>` opening a `display:none` file
 * input), which made PDF upload keyboard-unreachable, and axe reported nothing.
 */
const NATIVE_INTERACTIVE_TAGS = new Set([
  "a",
  "abbr",
  "audio",
  "button",
  "details",
  "input",
  "label",
  "option",
  "select",
  "summary",
  "textarea",
  "video",
]);
const POINTER_HANDLER_ATTRS = new Set(["onClick", "onMouseDown", "onPointerDown"]);
const KEY_HANDLER_ATTRS = new Set(["onKeyDown", "onKeyUp", "onKeyPress"]);

export function countMouseOnlyInteractions(sourceText, fileName) {
  const sourceFile = ts.createSourceFile(
    fileName,
    sourceText,
    ts.ScriptTarget.Latest,
    /* setParentNodes */ true,
    fileName.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
  let hits = 0;
  const visit = (node) => {
    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
      const tag = node.tagName.getText(sourceFile).split(".").pop();
      const attrs = node.attributes.properties.filter(ts.isJsxAttribute).map((a) => a.name.getText(sourceFile));
      const clickable = attrs.some((a) => POINTER_HANDLER_ATTRS.has(a));
      const keyboardReachable = attrs.some((a) => KEY_HANDLER_ATTRS.has(a));
      const component = /^[A-Z]/.test(node.tagName.getText(sourceFile));
      // A custom component may forward the handler to a real button, so it is not
      // evidence either way; only a host element we cannot click with a keyboard counts.
      if (clickable && !keyboardReachable && !component && !NATIVE_INTERACTIVE_TAGS.has(tag)) hits += 1;
    }
    ts.forEachChild(node, visit);
  };
  ts.forEachChild(sourceFile, visit);
  return hits;
}

function countMouseOnlyInteractionsInSrc() {
  return sourceFiles().reduce((sum, f) => {
    const name = path.relative(ROOT, f);
    if (!name.endsWith(".tsx")) return sum;
    return sum + countMouseOnlyInteractions(fs.readFileSync(f, "utf8"), name);
  }, 0);
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
    hardInternalNavigations: countHardInternalNavigationsInSrc(),
    mouseOnlyInteractions: countMouseOnlyInteractionsInSrc(),
    anyEscapes: countAnyEscapesInSrc(),
    longestSourceFiles: withLines,
    // Scalar sibling, because numericLeaves maps an array to its length: a
    // ceiling on longestSourceFiles would bound how many rows this report
    // prints, not how long the code is. See tests/unit/facts-ratchet.test.ts.
    longestSourceFileLines: withLines[0]?.lines ?? 0,
    // An array, because the number a ceiling needs is its length and the names are
    // what makes the next removal a decision rather than a guess.
    unreferencedProductionDeps: findUnreferencedProductionDeps(
      Object.keys(readJson("package.json")?.dependencies ?? {}),
      importedSpecifiersInSrc(),
      installedPeerDependencies,
    ),
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

  // Ring A promotion: `/api/analyze-trends` was discovered to have no caller
  // outside its own tests. "Route nobody calls" is mechanical, so measure it
  // every run instead of re-finding it by hand. A route is called if its
  // `/api/<name>` prefix appears anywhere outside its own handler — which covers
  // template literals (`fetch(\`/api/${x}\`)`) and query suffixes alike.
  const apiDir = path.join(appDir, "api");
  const routeFiles = fs.existsSync(apiDir) ? walk(apiDir).filter((f) => nameOf(f) === "route.ts") : [];
  const readAll = (files) =>
    files.map((f) => { try { return fs.readFileSync(f, "utf8"); } catch { return ""; } }).join("\n");
  const callerHaystack = readAll([
    ...sourceFiles().filter((f) => !f.startsWith(apiDir + path.sep)),
    ...(fs.existsSync(path.join(ROOT, "apps")) ? walk(path.join(ROOT, "apps")) : []),
  ]);
  const routeNames = routeFiles.map((f) => path.relative(apiDir, f).replace(/[/\\]route\.ts$/, ""));
  const orphanApiRoutes = routeNames
    .filter((name, i) => {
      const siblingHandlers = readAll(routeFiles.filter((_, j) => j !== i));
      return !`${callerHaystack}\n${siblingHandlers}`.includes(`/api/${name}`);
    })
    .sort();

  const warnings = [];
  // The installed package is scoped; looking up bare "next-pwa" only ever
  // matched through the config-text fallback, so a dep-only re-add was invisible.
  const hasPwaPlugin = ["@ducanh2912/next-pwa", "next-pwa"].some(
    (name) => pkg.dependencies?.[name] || pkg.devDependencies?.[name],
  );
  if (hasPwaPlugin || /next-pwa/.test(config)) {
    if (swFiles.length === 0) warnings.push("pwa_plugin_declares_offline_but_no_service_worker_emitted");
  }
  if (/^\s*webpack\s*:/m.test(config) && !/--webpack/.test(`${scripts.dev ?? ""} ${scripts.build ?? ""}`)) {
    warnings.push("webpack_config_block_present_but_build_scripts_do_not_select_webpack");
  }
  if (manifest?.display && swFiles.length === 0) {
    warnings.push("manifest_declares_standalone_display_without_service_worker");
  }
  if (orphanApiRoutes.length) {
    warnings.push(`api_route_without_client_caller:${orphanApiRoutes.join(",")}`);
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
      rawFetchCalls: countRawFetchCallSitesInSrc(),
      clientComponentFiles: clientFiles.length,
    },
    probeBlindPaths: [...probeBlindPaths].sort(),
    untestedChatCallbacks: untestedCallbacks,
    orphanApiRoutes,
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
  "debt.selectStarHits": "SELECT '*' — adjudicated 2026-09-19, re-verified 2026-09-26: dashboard list rows feed blob readers (SessionDetailModal councilDebate, KnowledgeMatchLoader resumeText/jobDescription). Reopens only with a lazy-get refactor of those two open paths, never blind.",
  "debt.tsIgnoreHits": "type-check suppressions",
  "debt.todoMarkers": "TODO/FIXME/HACK/XXX left behind",
  "debt.hardInternalNavigations":
    "whole-document navigations to an app route, which drop every client module and re-run every initial fetch. "
    + "Adjudicated 2026-10-05: 3 found, 2 removed (error.tsx 'Go to Dashboard' and SessionDetailModal 'Interactive Replay' "
    + "were accidental — both are now router.push). The 1 that stays is useInterviewSettlement's end-of-interview exit, kept "
    + "deliberate because a full reload guarantees the microphone and both speech engines are torn down with the page; a client "
    + "transition would have to prove that teardown, and nothing here can observe it keyless. Reopens only with a verified teardown.",
  "debt.mouseOnlyInteractions":
    "clickable host elements with a pointer handler and no keyboard handler. An inventory, not a "
    + "verdict that all 9 are defects: 6 are `motion.div` backdrops/rows whose keyboard route may already "
    + "exist (Escape-closed dialogs), and each needs reading in context before it is fixed. What is "
    + "established is the shape — the resume dropzone in setup was exactly this and made PDF upload "
    + "keyboard-unreachable while axe stayed silent. The number may only go down. "
    + "Measured 2026-10-06: this AST walk finds 9; `jsx-a11y/click-events-have-key-events` reports 3 of "
    + "them, because eslint-plugin-jsx-a11y resolves only simple identifiers and cannot see a "
    + "`motion.div` tag — in a framer-motion codebase the eslint rules under-count by two thirds, which "
    + "is why enabling them is not the same as being covered.",
  "debt.anyEscapes": "explicit `any` escaping the strict config",
  "debt.auditDocsLines": "docs/audit prose volume — the audit apparatus must not outgrow the product",
  "debt.unreferencedProductionDeps":
    "production dependencies no file under src/ imports. Adjudicated 2026-10-06 at 4: `dexie`, "
    + "`dexie-react-hooks`, `geist`, `mermaid` — zero references repo-wide outside generated "
    + "`*.tsbuildinfo`, verified with a scan that counts CSS `@import` and lazy `import()`. They "
    + "stay installed because dropping a dependency is an owner decision, not a cleanup an audit "
    + "makes alone; each removal should lower this ceiling, and nothing should raise it. A new "
    + "entry here is a manifest claim, not a feature.",
  "debt.longestSourceFileLines": "size of the single largest file under src/ — the God-component ceiling; lower it as extraction lands, never raise it to accommodate a new blob",
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
