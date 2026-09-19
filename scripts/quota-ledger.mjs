// quota-ledger.mjs — Phase C1: centralized FREE-tier quota ledger ($0).
//
// Why: keyed suites used to discover "no quota left" via a live 429 AFTER
// burning a call. Every keyed entry point now checks this ledger FIRST and
// self-skips (exit 0) when the remaining budget cannot cover its planned
// calls. Successful calls are recorded back (1 per HTTP 200 only — 429s and
// 500s are rejected/ambiguous and never counted).
//
// Design (lightweight, zero dependencies, plain node from v20):
//   - One JSON file (default: repo-root `.quota-ledger.json`, gitignored;
//     override with QUOTA_LEDGER_PATH). Same code path locally and in CI.
//   - Zhipu / Gemini counted SEPARATELY. RPD windows align to PT midnight
//     (Beijing 15:00), the same reset the providers use (see EVAL_REPORT
//     §5.1). Stale windows roll over automatically on next read.
//   - Budgets are env-overridable: QUOTA_ZHIPU_RPD (default 50, provisional —
//     covers nightly 31 + smoke 3 with headroom; calibrate to the actual
//     plan), QUOTA_GEMINI_RPD (default 20 per V3 iron rule).
//   - QUOTA_LEDGER_DISABLE=1 bypasses checks (records become no-ops). The
//     upstream 429 remains the backstop; this ledger is a guardrail, not a
//     license. It is per-machine: parallel CI jobs each start from a fresh
//     file, which is safe because CI keyed jobs are fixed tiny caps (≤3).
//   - The ledger stores COUNTS ONLY — never keys, prompts, or transcripts.
//
// CLI (counts only, never secrets):
//   node scripts/quota-ledger.mjs status
//   node scripts/quota-ledger.mjs check <zhipu|gemini> <need>   (exit 0 ok / 2 insufficient)
//   node scripts/quota-ledger.mjs record <zhipu|gemini> <count>

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const PROVIDER_DEFS = {
  zhipu: { budgetEnv: "QUOTA_ZHIPU_RPD", defaultBudget: 50 },
  gemini: { budgetEnv: "QUOTA_GEMINI_RPD", defaultBudget: 20 },
};

const ptDayFmt = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Los_Angeles",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** RPD window key: PT calendar day (YYYY-MM-DD). PT midnight == Beijing 15:00. */
export function ptDayKey(now = new Date()) {
  return ptDayFmt.format(now);
}

export function isProvider(p) {
  return Object.prototype.hasOwnProperty.call(PROVIDER_DEFS, p);
}

function assertProvider(provider) {
  if (!isProvider(provider)) throw new Error(`[quota-ledger] unknown provider: ${String(provider)} (want zhipu|gemini)`);
}

function assertNonNegativeInt(n, what) {
  if (!Number.isInteger(n) || n < 0) throw new Error(`[quota-ledger] ${what} must be a non-negative integer, got: ${String(n)}`);
}

/** Daily budget for a provider (env-overridable, provisional defaults). */
export function providerBudget(provider) {
  assertProvider(provider);
  const raw = process.env[PROVIDER_DEFS[provider].budgetEnv];
  const parsed = raw === undefined || raw === "" ? NaN : Number.parseInt(raw, 10);
  if (!Number.isInteger(parsed) || parsed <= 0) return PROVIDER_DEFS[provider].defaultBudget;
  return parsed;
}

export function ledgerPath() {
  if (process.env.QUOTA_LEDGER_PATH) return process.env.QUOTA_LEDGER_PATH;
  return path.join(path.dirname(fileURLToPath(import.meta.url)), "..", ".quota-ledger.json");
}

export function isDisabled() {
  return process.env.QUOTA_LEDGER_DISABLE === "1";
}

/** Read the ledger; missing/corrupt files start fresh (never throws). */
export function readLedger(ledgerFile = ledgerPath()) {
  const fresh = { version: 1, windows: {} };
  let raw;
  try {
    raw = fs.readFileSync(ledgerFile, "utf8");
  } catch {
    return fresh;
  }
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || typeof parsed.windows !== "object" || parsed.windows === null) {
      return fresh;
    }
    const windows = {};
    for (const [provider, entry] of Object.entries(parsed.windows)) {
      if (!isProvider(provider)) continue;
      if (!entry || typeof entry !== "object") continue;
      const { window, used } = entry;
      if (typeof window !== "string" || !Number.isInteger(used) || used < 0) continue;
      windows[provider] = { window, used };
    }
    return { version: 1, windows };
  } catch {
    return fresh;
  }
}

function writeLedger(ledger, ledgerFile) {
  fs.writeFileSync(ledgerFile, `${JSON.stringify(ledger, null, 2)}\n`, "utf8");
}

/**
 * Check whether `need` calls fit in today's remaining budget.
 * Never throws on IO problems (fail-open to full budget with bypassed flag
 * only when explicitly disabled; corrupt files read as fresh).
 */
export function quotaCheck(provider, need = 1, opts = {}) {
  assertProvider(provider);
  assertNonNegativeInt(need, "need");
  const ledgerFile = opts.ledgerFile ?? ledgerPath();
  const now = opts.now ?? new Date();
  const window = ptDayKey(now);
  const budget = providerBudget(provider);
  if (isDisabled()) {
    return { ok: true, bypassed: true, provider, window, budget, used: 0, remaining: budget, need };
  }
  const ledger = readLedger(ledgerFile);
  const entry = ledger.windows[provider];
  const used = entry && entry.window === window ? entry.used : 0;
  const remaining = Math.max(0, budget - used);
  return { ok: remaining >= need, bypassed: false, provider, window, budget, used, remaining, need };
}

/** Record `count` successful (HTTP 200) calls. No-op when disabled. */
export function quotaRecord(provider, count = 1, opts = {}) {
  assertProvider(provider);
  assertNonNegativeInt(count, "count");
  if (isDisabled()) return { provider, window: ptDayKey(opts.now ?? new Date()), used: 0, recorded: 0, bypassed: true };
  const ledgerFile = opts.ledgerFile ?? ledgerPath();
  const window = ptDayKey(opts.now ?? new Date());
  const ledger = readLedger(ledgerFile);
  const prev = ledger.windows[provider];
  const used = (prev && prev.window === window ? prev.used : 0) + count;
  ledger.windows[provider] = { window, used };
  writeLedger(ledger, ledgerFile);
  return { provider, window, used, recorded: count, bypassed: false };
}

/** Human/CI-readable status (counts only). */
export function quotaStatus(opts = {}) {
  const now = opts.now ?? new Date();
  return ["zhipu", "gemini"].map((provider) => {
    const c = quotaCheck(provider, 0, { ...opts, now });
    return { provider: c.provider, window: c.window, budget: c.budget, used: c.used, remaining: c.remaining };
  });
}

function printUsageAndExit() {
  console.error("usage: node scripts/quota-ledger.mjs <status|check|record> [provider] [n]");
  console.error("  status                    show windows + used/budget (counts only)");
  console.error("  check <zhipu|gemini> <n>  exit 0 if n calls fit, exit 2 if not");
  console.error("  record <zhipu|gemini> <n> record n successful calls");
  process.exit(1);
}

function cli() {
  const [, , cmd, provider, nRaw] = process.argv;
  if (cmd === "status") {
    for (const s of quotaStatus()) {
      console.log(`[quota-ledger] ${s.provider}: window(PT) ${s.window} used ${s.used}/${s.budget} remaining ${s.remaining}`);
    }
    return;
  }
  if (cmd === "check" || cmd === "record") {
    if (!provider || nRaw === undefined) printUsageAndExit();
    const n = Number.parseInt(nRaw, 10);
    try {
      if (cmd === "check") {
        const c = quotaCheck(provider, n);
        console.log(
          `[quota-ledger] check ${c.provider} need=${c.need} window(PT)=${c.window} used=${c.used}/${c.budget} remaining=${c.remaining} -> ${c.ok ? "OK" : "INSUFFICIENT"}`
        );
        process.exit(c.ok ? 0 : 2);
      } else {
        const r = quotaRecord(provider, n);
        console.log(`[quota-ledger] record ${r.provider} +${r.recorded} window(PT)=${r.window} used=${r.used}`);
      }
    } catch (err) {
      console.error(String(err && err.message ? err.message : err));
      process.exit(1);
    }
    return;
  }
  printUsageAndExit();
}

const invokedAsMain =
  typeof process.argv[1] === "string" &&
  pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url;
if (invokedAsMain) cli();
