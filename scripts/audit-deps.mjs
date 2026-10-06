#!/usr/bin/env node
// Ring B for the dependency surface: one command, two distinct claims, neither
// allowed to drift silently.
//
// Why this replaced `npm audit --audit-level=critical` in CI:
// that single step folded the shipped product and the developer's toolchain into
// one number, so (a) a critical in `vitest`'s worker pool blocks a docs-only PR
// exactly like a critical in the deployed bundle, and (b) the fix for the first is
// a major-version migration while the fix for the second is a version bump. The
// day the advisories for `proxy-addr` and `tinypool` were published, every open
// branch went red at once with no code change — which is the same "gate that can
// never converge" shape as the CSP ceiling, and it trains people to reach for
// `--omit` flags rather than to read the list.
//
// So the shipped tree keeps a hard, unscoped bar: zero criticals, no register, no
// exceptions. The developer tree keeps a *disclosure* bar: the set of packages with
// critical advisories must equal the set named in docs/audit/deps-critical.json.
// A new one fails. A fixed one that nobody retired also fails, because a register
// that names a vulnerability the repo no longer has is a false statement about the
// product's risk, which is what registers are supposed to prevent.

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const REGISTER_PATH = 'docs/audit/deps-critical.json';

/** GHSA/CVE ids an advisory entry refers to, from its URLs. */
export function advisoryIds(via) {
  const ids = new Set();
  for (const entry of via ?? []) {
    const url = typeof entry === 'string' ? '' : entry.url ?? '';
    for (const m of url.matchAll(/(GHSA-[0-9a-z-]+|CVE-[0-9-]+)/g)) ids.add(m[1]);
  }
  return [...ids].sort();
}

/** Packages whose top-level severity is `critical` in one audit document. */
export function criticalPackages(audit) {
  return Object.entries(audit?.vulnerabilities ?? {})
    .filter(([, info]) => info?.severity === 'critical')
    .map(([name]) => name)
    .sort();
}

/**
 * The whole decision, pure: three documents in, a verdict out.
 * Returns `{ ok, failures, prodCritical, devCritical }`.
 */
export function evaluate({ prodAudit, fullAudit, register }) {
  const failures = [];
  const prodCritical = criticalPackages(prodAudit);
  const allCritical = criticalPackages(fullAudit);
  const devCritical = allCritical.filter((name) => !prodCritical.includes(name));

  // 1. The shipped tree has no register. Zero criticals or fail.
  if (prodCritical.length) {
    failures.push(
      `critical advisory in the SHIPPED dependency tree (no exception path): ${prodCritical.join(', ')}`,
    );
  }

  // 2. The developer tree must match the disclosure exactly, in both directions.
  const registered = (register?.devOnlyCritical ?? []).map((e) => e.package).sort();
  const missing = devCritical.filter((name) => !registered.includes(name));
  const stale = registered.filter((name) => !devCritical.includes(name));
  if (missing.length) {
    failures.push(
      `new critical advisory in the developer tree, undisclosed: ${missing.join(', ')} ` +
        `(add an entry to ${REGISTER_PATH} with the GHSA ids and what actually fixes it)`,
    );
  }
  if (stale.length) {
    failures.push(
      `${REGISTER_PATH} names ${stale.join(', ')} as a dev-only critical, and it no longer is ` +
        `(retire the entry: leaving it reads as a risk the repo still carries)`,
    );
  }

  // 3. A registered entry that is silently also in the shipped tree is the worst
  //    possible state: the exception was written for a dev dependency and the
  //    same package is now deployed.
  const leaked = registered.filter((name) => prodCritical.includes(name));
  if (leaked.length) {
    failures.push(
      `a package disclosed as dev-only is in the shipped tree: ${leaked.join(', ')} — check which ` +
        `field of package.json it lives in`,
    );
  }

  return { ok: failures.length === 0, failures, prodCritical, devCritical, registered };
}

function runAudit(args) {
  const cwd = resolve(import.meta.dirname, '..');
  try {
    return JSON.parse(
      execFileSync('npm', ['audit', '--json', ...args], {
        cwd,
        encoding: 'utf8',
        maxBuffer: 64 * 1024 * 1024,
        // `npm audit --json` exits non-zero as soon as it finds anything at or above
        // the level, and still writes the full report. The verdict comes from that
        // document, never from the exit code — a folded code path here would silently
        // read as "no advisories".
        env: { ...process.env, NO_PROXY: '*', no_proxy: '*' },
      }),
    );
  } catch (err) {
    const body = err.stdout?.toString() ?? '';
    if (body.trim()) return JSON.parse(body);
    throw err;
  }
}

function flagValue(argv, name) {
  const i = argv.indexOf(name);
  return i === -1 ? null : argv[i + 1];
}

export function main(argv = process.argv.slice(2)) {
  // A seam for the test suite: two audit documents on disk, so the end-to-end
  // behaviour of the gate — including its exit code — is provable without reaching
  // the advisory feed. The CI step uses no flags and reads the live documents.
  const prodPath = flagValue(argv, '--prod-doc');
  const fullPath = flagValue(argv, '--full-doc');
  const prodAudit = prodPath ? JSON.parse(readFileSync(resolve(prodPath), 'utf8')) : runAudit(['--omit=dev']);
  const fullAudit = fullPath ? JSON.parse(readFileSync(resolve(fullPath), 'utf8')) : runAudit([]);
  const registerPath = flagValue(argv, '--register') ?? REGISTER_PATH;
  const register = JSON.parse(readFileSync(resolve(import.meta.dirname, '..', registerPath), 'utf8'));

  const verdict = evaluate({ prodAudit, fullAudit, register });
  const line = (s) => process.stdout.write(`${s}\n`);
  line(`deps audit: shipped criticals=${verdict.prodCritical.length} developer criticals=${verdict.devCritical.length} disclosed=${verdict.registered.length}`);
  if (verdict.devCritical.length) {
    line(`  developer tree: ${verdict.devCritical.join(', ')}`);
  }
  for (const f of verdict.failures) line(`  FAIL ${f}`);
  if (!verdict.ok) {
    line(`exit 1 — see ${REGISTER_PATH}`);
    process.exit(1);
  }
  line('deps audit: OK');
}

// Run when invoked directly. Comparing `import.meta.url` to `file://${argv[1]}`
// silently never matches under `npm run`, because npm passes a *relative* path —
// which turns the whole gate into a no-op that exits 0. Resolve both sides instead.
const invokedDirectly =
  process.argv[1] !== undefined && resolve(process.argv[1]) === resolve(import.meta.filename);
if (invokedDirectly) main();
