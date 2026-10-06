import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import playwrightConfig from "../../playwright.config";

/**
 * The README's testing table and CI sentence are the first thing a new contributor
 * (or an audit prompt) reads, and they had drifted into three false statements:
 * a 12-project matrix claimed to run in CI on a runner that installs chromium only,
 * a dependency step named a command CI no longer runs, and an advisory count asserted
 * "triaged non-reachable" for a package that was in fact in the shipped tree.
 *
 * So each claim is now derived from the thing it describes rather than restated: the
 * script list, the workflow's own run lines, and the Playwright config's project array.
 */

const readme = readFileSync(new URL("../../README.md", import.meta.url), "utf8");
const ci = readFileSync(new URL("../../.github/workflows/ci.yml", import.meta.url), "utf8");
const pkg = JSON.parse(readFileSync(new URL("../../package.json", import.meta.url), "utf8"));

const ciRunLines = ci
  .split("\n")
  .map((line) => /^\s*-\s+(?:name:.*\n\s*)?run:\s*(.+?)\s*$/.exec(line)?.[1])
  .filter((s): s is string => Boolean(s));

describe("the README's testing claims match the machinery they describe", () => {
  it("names only scripts the repo actually has", () => {
    const commands = [...readme.matchAll(/`(npm (?:run [\w:.|-]+|ci|install)[^`]*)`/g)].map((m) => m[1]);
    expect(commands.length, "no npm commands quoted in README at all").toBeGreaterThan(5);
    for (const command of commands) {
      const run = /^npm run ([\w:.-]+)/.exec(command);
      if (!run) continue; // `npm ci` / `npm install` are not scripts
      expect(pkg.scripts, `README runs \`npm run ${run[1]}\`, which package.json does not define`).toHaveProperty(run[1]);
    }
  });

  it("does not restate an advisory count that only the audit report can know", () => {
    // The line this replaces read "`npm audit` 37 (1L/31M/5H/0C) triaged
    // non-reachable": the count was stale within days, and "non-reachable" was false
    // for a package that was sitting in the shipped dependency tree. A number nobody
    // can re-derive is not documentation, it is an attribution risk.
    expect(readme).not.toMatch(/`npm audit`?\s+\d+/);
    expect(readme).not.toMatch(/\d+\s*\((?:[\d]+[LMH]\/)+[\d]+C\)/);
  });

  it("describes the dependency gate with the command CI really runs", () => {
    const auditLine = ciRunLines.filter((line) => /\baudit\b/.test(line));
    expect(auditLine.length, "CI has no dependency-audit step to describe").toBe(1);
    const sentence = readme
      .split("\n")
      .find((line) => line.startsWith("CI (`.github/workflows/ci.yml`"));
    expect(sentence, "README lost its CI sentence").toBeDefined();
    expect(sentence!).toContain(auditLine[0]);
  });

  it("does not claim a lane for CI that the workflow never runs", () => {
    const sentence = readme
      .split("\n")
      .find((line) => line.startsWith("CI (`.github/workflows/ci.yml`"));
    // Everything the sentence says CI does must appear as a run line (or be one of the
    // setup/CI-internal steps, which are named by their own command).
    for (const command of [...(sentence ?? "").matchAll(/`npm run ([\w:.-]+)`/g)].map((m) => m[1])) {
      const asRun = ciRunLines.some((line) => line.includes(`npm run ${command}`));
      expect(asRun, `README says CI runs \`npm run ${command}\`; ci.yml does not`).toBe(true);
    }
  });

  it("states the matrix size the config actually builds, and where it runs", () => {
    const projects = (playwrightConfig as { projects?: unknown[] }).projects ?? [];
    expect(projects.length, "playwright config builds no projects").toBeGreaterThan(1);
    const claims = [...readme.matchAll(/(\d+)-project matrix/g)].map((m) => Number(m[1]));
    expect(claims.length, "README no longer mentions the matrix at all").toBeGreaterThan(0);
    for (const claim of claims) {
      expect(claim, `README quotes a ${claim}-project matrix; config builds ${projects.length}`).toBe(projects.length);
    }
    // The full matrix cannot be a CI lane here, so any README sentence about it must
    // say so: check by absence, not by belief.
    const runsFullMatrix = ciRunLines.some((line) => /npm run test:e2e$/.test(line));
    if (!runsFullMatrix) {
      const matrixLine = readme.split("\n").find((line) => /-project matrix/.test(line)) ?? "";
      expect(matrixLine.toLowerCase(), "matrix is not a CI lane; README must not imply it is").toMatch(
        /local-only|not a ci lane/,
      );
    }
  });
});
