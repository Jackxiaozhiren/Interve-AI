import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { advisoryIds, criticalPackages, evaluate } from "../../scripts/audit-deps.mjs";

const REPO = resolve(import.meta.dirname, "../..");

// The dependency gate is only as good as the split it makes, so the split gets
// tested against documents the way `npm audit --json` actually shapes them:
// top-level keys are packages, each with a `severity` and a `via` list whose
// entries are either another package name or an advisory object with a URL.

const doc = (entries: Record<string, { severity: string; via?: unknown[] }>) =>
  ({ vulnerabilities: entries }) as never;

const register = {
  devOnlyCritical: [{ package: "vitest", advisories: ["GHSA-82fw-gwwq-j7x9"] }],
};

describe("the shipped/developer split is the one thing the gate is for", () => {
  it("reads criticals by package, ignoring lower severities", () => {
    const audit = doc({
      vitest: { severity: "critical", via: [{ url: "https://github.com/advisories/GHSA-82fw-gwwq-j7x9" }] },
      "esbuild": { severity: "moderate", via: [] },
      "tinypool": { severity: "high", via: [] },
    });
    expect(criticalPackages(audit)).toEqual(["vitest"]);
  });

  it("collects GHSA ids from advisory URLs", () => {
    const ids = advisoryIds([
      { url: "https://github.com/advisories/GHSA-5gmw-xhrv-c9v3", title: "Tinypool RCE" },
      "vitest",
      { url: "https://github.com/advisories/GHSA-85c8-ppgw-ccpr" },
    ]);
    expect(ids).toEqual(["GHSA-5gmw-xhrv-c9v3", "GHSA-85c8-ppgw-ccpr"]);
  });

  it("passes when the shipped tree is clean and the developer tree is disclosed", () => {
    const verdict = evaluate({
      prodAudit: doc({}),
      fullAudit: doc({ vitest: { severity: "critical", via: [] } }),
      register,
    });
    expect(verdict.failures).toEqual([]);
    expect(verdict.ok).toBe(true);
  });

  it("fails a critical in the shipped tree, because that half has no register", () => {
    const verdict = evaluate({
      prodAudit: doc({ express: { severity: "critical", via: [] } }),
      fullAudit: doc({ express: { severity: "critical", via: [] } }),
      register,
    });
    expect(verdict.ok).toBe(false);
    expect(verdict.failures.join(" ")).toMatch(/SHIPPED/);
  });

  it("fails an undisclosed developer critical", () => {
    const verdict = evaluate({
      prodAudit: doc({}),
      fullAudit: doc({ "some-new-cli": { severity: "critical", via: [] } }),
      register,
    });
    expect(verdict.failures.join(" ")).toMatch(/undisclosed/);
  });

  it("fails a disclosure nobody retired, so the register cannot become a fiction", () => {
    const verdict = evaluate({
      prodAudit: doc({}),
      fullAudit: doc({}),
      register,
    });
    expect(verdict.failures.join(" ")).toMatch(/no longer is/);
  });

  it("fails a package disclosed as dev-only that is now in the shipped tree", () => {
    // This is the `shadcn` shape: the register was written while the package hung
    // off devDependencies, and someone later moves it (or its twin) into
    // `dependencies`. The exception silently becomes a deployed risk.
    const verdict = evaluate({
      prodAudit: doc({ vitest: { severity: "critical", via: [] } }),
      fullAudit: doc({ vitest: { severity: "critical", via: [] } }),
      register,
    });
    expect(verdict.failures.join(" ")).toMatch(/dev-only is in the shipped tree/);
  });
});

describe("the register as shipped", () => {
  const text = readFileSync(new URL("../../docs/audit/deps-critical.json", import.meta.url), "utf8");
  const parsed = JSON.parse(text) as {
    devOnlyCritical: { package: string; advisories: string[]; why_dev_only: string; what_actually_fixes_it: string; decision: string }[];
    closed: { package: string; now: string; advisories: string[] }[];
  };
  const pkg = JSON.parse(readFileSync(new URL("../../package.json", import.meta.url), "utf8"));

  it("names every dev-only critical with an id, a reason, a fix and a decision", () => {
    expect(parsed.devOnlyCritical.length).toBeGreaterThan(0);
    for (const entry of parsed.devOnlyCritical) {
      expect(entry.advisories.every((a) => /^GHSA-/.test(a)), `${entry.package} advisories`).toBe(true);
      expect(entry.why_dev_only.length, `${entry.package} has no reachability reason`).toBeGreaterThan(20);
      expect(entry.what_actually_fixes_it.length, `${entry.package} has no fix path`).toBeGreaterThan(10);
      expect(["OPEN", "ACCEPTED"].includes(entry.decision.split(" ")[0]), `${entry.package} decision`).toBe(true);
    }
  });

  it("discloses nothing that lives in the shipped dependency list", () => {
    // The register's whole licence to exist is "dev-only". A registered name that
    // is also a direct `dependencies` entry means the bar is being applied to
    // deployed code, which is the failure mode this gate replaced.
    const shipped = Object.keys(pkg.dependencies ?? {});
    for (const entry of parsed.devOnlyCritical) {
      expect(shipped, `${entry.package} is in package.json dependencies`).not.toContain(entry.package);
    }
  });

  it("keeps a CLI out of the shipped tree, which is how proxy-addr got there", () => {
    // `shadcn` drags @modelcontextprotocol/sdk -> express -> proxy-addr: 276
    // packages of server stack that no product file imports.
    expect(pkg.dependencies).not.toHaveProperty("shadcn");
    expect(pkg.devDependencies).toHaveProperty("shadcn");
  });

  it("states ids that npm's own report actually contains", () => {
    const fromReport = parsed.devOnlyCritical
      .flatMap((e) => e.advisories)
      .concat(parsed.closed.flatMap((e) => e.advisories));
    expect(fromReport.length).toBeGreaterThanOrEqual(4);
    expect(new Set(fromReport).size, "the same advisory id disclosed twice").toBe(fromReport.length);
  });
});

describe("the CI gate is the split, not the folded command", () => {
  const ci = readFileSync(new URL("../../.github/workflows/ci.yml", import.meta.url), "utf8");
  // The commands the runner actually executes, not the prose around them: the
  // workflow *explains* why the folded command was replaced, so a substring check
  // for it would read its own explanation as a regression.
  const runLines = ci
    .split("\n")
    .map((line) => /^\s*-\s+run:\s*(.+?)\s*$/.exec(line)?.[1])
    .filter((s): s is string => Boolean(s));

  it("runs the two-sided check", () => {
    expect(runLines).toContain("npm run audit:deps");
  });

  it("does not quietly go back to one number for two different risks", () => {
    const folded = runLines.filter((line) => /^npm audit\b/.test(line));
    expect(folded, `folded audit step is back: ${folded.join(" | ")}`).toEqual([]);
  });

  it("keeps the audit step in the gate job, where it can block", () => {
    const gateJob = /jobs:\s*\n\s*gate:([\s\S]*?)\n  [a-z-]+:/.exec(ci);
    expect(gateJob, "no gate job found").not.toBeNull();
    expect(gateJob![1]).toContain("npm run audit:deps");
  });
});

describe("the gate end to end, as the runner invokes it", () => {
  // A first version of this script compared `import.meta.url` to a *relative*
  // argv[1], which never matched under `npm run`: the CLI quietly skipped its own
  // `main()` and exited 0 whatever the advisories said. These cases run the file
  // the way CI does and read its exit code, so a no-op gate cannot ship again.
  const dir = mkdtempSync(resolve(tmpdir(), "deps-audit-"));
  const runCli = (prod: unknown, full: unknown) => {
    const prodPath = resolve(dir, "prod.json");
    const fullPath = resolve(dir, "full.json");
    writeFileSync(prodPath, JSON.stringify({ vulnerabilities: prod }));
    writeFileSync(fullPath, JSON.stringify({ vulnerabilities: full }));
    try {
      const stdout = execFileSync(
        "node",
        ["scripts/audit-deps.mjs", "--prod-doc", prodPath, "--full-doc", fullPath],
        { cwd: REPO, encoding: "utf8" },
      );
      return { code: 0, out: stdout };
    } catch (err) {
      const e = err as { status?: number; stdout?: string; stderr?: string };
      return { code: e.status ?? -1, out: `${e.stdout ?? ""}${e.stderr ?? ""}` };
    }
  };

  it("exits 0 when the shipped tree is clean and the developer tree is disclosed", () => {
    // Both packages the register names, or the stale-disclosure branch correctly
    // fires — which is this fixture's own control: it caught me writing it with
    // one of the two missing.
    const { code, out } = runCli(
      {},
      { vitest: { severity: "critical", via: [] }, tinypool: { severity: "critical", via: [] } },
    );
    expect(out).toContain("deps audit: OK");
    expect(code).toBe(0);
  });

  it("exits 1 on a critical in the shipped tree", () => {
    const { code, out } = runCli(
      { express: { severity: "critical", via: [] } },
      { express: { severity: "critical", via: [] }, vitest: { severity: "critical", via: [] } },
    );
    expect(code).toBe(1);
    expect(out).toMatch(/SHIPPED dependency tree/);
  });

  it("exits 1 on an undisclosed developer critical", () => {
    const { code, out } = runCli(
      {},
      { vitest: { severity: "critical", via: [] }, "new-thing": { severity: "critical", via: [] } },
    );
    expect(code).toBe(1);
    expect(out).toMatch(/undisclosed/);
  });

  it("exits 1 when a disclosure was never retired", () => {
    const { code, out } = runCli({}, {});
    expect(code).toBe(1);
    expect(out).toMatch(/no longer is/);
  });

  it("refuses to guess when it was given no reports", () => {
    // Called without the two documents — the shape a broken wrapper would produce.
    // Defaulting to "clean" here would be the same failure as the no-op entry guard
    // this script already shipped once.
    try {
      const stdout = execFileSync("node", ["scripts/audit-deps.mjs"], { cwd: REPO, encoding: "utf8" });
      throw new Error(`expected a non-zero exit, got 0 with: ${stdout}`);
    } catch (err) {
      const e = err as { status?: number; stdout?: string; stderr?: string; message?: string };
      if (e.status === undefined) throw err; // a real failure of the expectation itself
      expect(e.status).toBe(2);
      expect(`${e.stderr ?? ""}${e.stdout ?? ""}`).toMatch(/usage: node scripts\/audit-deps\.mjs/);
    }
  });

  it("collects the documents in the wrapper rather than spawning npm from the gate", () => {
    const shell = readFileSync(resolve(REPO, "scripts/audit-deps.sh"), "utf8");
    expect(shell).toContain("npm audit --json --omit=dev");
    expect(shell).toContain("--prod-doc");
    expect(shell).toContain("--full-doc");
    const gate = readFileSync(resolve(REPO, "scripts/audit-deps.mjs"), "utf8");
    expect(gate).not.toMatch(/child_process/);
  });
});
