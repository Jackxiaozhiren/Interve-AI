import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
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
const testing = readFileSync(new URL("../../docs/TESTING.md", import.meta.url), "utf8");

/**
 * Read the Playwright config as both schedules.
 *
 * `playwright.config.ts` picks its numbers off `process.env.CI`, so the file a
 * contributor edits and the numbers a given run used are two different readings —
 * and the difference between them is the whole of V11-20: three specs have failed
 * inside a local lane, each at a different fixed budget, and each one passes alone.
 * Re-importing with and without `CI` lets this say something about both branches
 * instead of about whichever one the test process happens to sit in, which is how a
 * green unit run in CI and a green unit run locally can assert the same thing.
 */
type Schedule = {
  workers?: unknown;
  retries?: number;
  timeout?: number;
  expect?: { timeout?: number };
  webServer?: { reuseExistingServer?: boolean };
};
const loadSchedule = async (withCI: boolean): Promise<Schedule> => {
  const previous = process.env.CI;
  if (withCI) process.env.CI = "true";
  else delete process.env.CI;
  try {
    vi.resetModules();
    const mod = (await import("../../playwright.config")) as { default: Schedule };
    return mod.default;
  } finally {
    if (previous === undefined) delete process.env.CI;
    else process.env.CI = previous;
  }
};

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

  it("does not restate a count that only a run can know", () => {
    // "369 vitest (50 files)" and "build 44/44" were both wrong by the time they
    // were read: the suite is ~1000 tests in ~120 files, and a count written into a
    // README starts decaying on the next commit. The advisory-count rule above made
    // the same argument and this is the rest of it — a number nobody can re-derive
    // from the line it sits on is an attribution risk, not documentation.
    expect(readme).not.toMatch(/\d+\s+(?:vitest\s+)?tests?/i);
    expect(readme).not.toMatch(/\(\d+ files\)/);
    expect(readme).not.toMatch(/build \d+\/\d+/);
    expect(readme).not.toMatch(/desktop \d+\/\d+\/\d+\/\d+/);
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

  it("keeps the local-vs-CI lane schedule visible where it is used", async () => {
    const ciShape = await loadSchedule(true);
    const localShape = await loadSchedule(false);

    expect(ciShape.workers, "CI runs the browser lanes on one worker").toBe(1);
    expect(ciShape.retries, "CI retries a failed attempt twice").toBe(2);
    expect(ciShape.webServer?.reuseExistingServer, "CI must start its own dev server, never borrow :3000").toBe(false);

    expect(localShape.workers, "a local lane runs on Playwright's default worker count").toBeUndefined();
    expect(localShape.retries, "a local first attempt is never retried").toBe(0);
    expect(localShape.webServer?.reuseExistingServer, "locally a lane can be served by a dev server another process owns").toBe(true);

    // The budgets V11-20's three cases died inside. They are config numbers, so a
    // change here has to move the finding's reading of them, not the other way round.
    expect(localShape.timeout, "per-test budget").toBe(60000);
    expect(localShape.expect?.timeout, "per-expectation budget").toBe(15000);

    // The three assertions above are the config's own numbers; this one is the
    // sentence an owner reads while deciding whether a red local spec means
    // anything, so it has to stay next to the lane it describes.
    const smokeRow = testing.split("\n").find((line) => line.includes("`npm run test:e2e:smoke`")) ?? "";
    expect(smokeRow, "docs/TESTING.md no longer has a smoke row to attach the warning to").not.toBe("");
    expect(smokeRow.replace(/\s+/g, " "), "a local smoke failure is schedule-relative and the doc must say so").toMatch(
      /single-worker control/,
    );
  });
});
