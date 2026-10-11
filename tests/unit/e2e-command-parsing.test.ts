/**
 * Every Playwright command this repo runs must actually parse.
 *
 * `visual:baselines` was written as
 * `… --update-snapshots tests/a11y-visual.spec.ts` and failed on the runner with
 *
 *   error: option '-u, --update-snapshots [mode]' argument
 *   'tests/a11y-visual.spec.ts' is invalid.
 *
 * because `--update-snapshots` takes an *optional* value, so the spec path was
 * consumed as that value. Nothing in the suite could see this: the script was
 * new, no test ran it, and `npm run` reports the failure only when something
 * executes it. A one-word typo in a package.json command is therefore invisible
 * until the lane is needed — which is exactly how a gate ends up not existing.
 *
 * `--list` parses the arguments, resolves the grep filters and reports the test
 * count without starting a browser.
 *
 * It is not cheap, and the suite used to pay for it inside the assertion's own
 * budget. Measured on this repo (2026-10-11, `npx playwright test --list
 * tests/landing.spec.ts`): **2.4s alone, 6.8-9.4s while the suite's own workers
 * contend for CPU.** Vitest's default per-test timeout is 5s, so under load the
 * spawn expired and reported `Test timed out in 5000ms` — a red that looks exactly
 * like a broken lane command. The listings now happen once, concurrently, under an
 * explicit hook budget; each test asserts on what was captured.
 */
import { execFile } from "node:child_process";
import { readFileSync } from "node:fs";
import { beforeAll, describe, expect, it } from "vitest";

const pkg = JSON.parse(readFileSync(new URL("../../package.json", import.meta.url), "utf8")) as {
  scripts: Record<string, string>;
};

/** Split a shell-ish command on whitespace, honouring double quotes. */
function argv(command: string): string[] {
  const out: string[] = [];
  for (const m of command.matchAll(/"([^"]*)"|(\S+)/g)) out.push(m[1] ?? m[2]!);
  return out;
}

const playwrightScripts = Object.entries(pkg.scripts).filter(([, cmd]) =>
  /\bplaywright\s+test\b/.test(cmd)
);

type Listing = { stdout: string; failure?: string; status?: number | null };

const listings = new Map<string, Listing>();

/** One lane's `--list`. Never throws: a parse failure is data the test reports. */
function list(command: string): Promise<Listing> {
  const args = argv(command).slice(1); // drop the leading `playwright`
  return new Promise((resolve) => {
    execFile(
      "npx",
      ["playwright", "test", "--list", ...args],
      { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 },
      (error, stdout, stderr) => {
        const e = error as (Error & { status?: number }) | null;
        if (!e) resolve({ stdout });
        else {
          // The process's own words matter: a spawn error carries no stdout at all,
          // and without `message` the report reads "exit ?" with nothing to act on.
          const detail = `${e.message}\n${stdout ?? ""}${stderr ?? ""}`;
          resolve({ stdout, failure: detail, status: e.status ?? null });
        }
      }
    );
  });
}

describe("the Playwright lanes are runnable commands", () => {
  // One at a time, deliberately: a first attempt ran all seven `--list` spawns
  // concurrently and `test:e2e:axe` started failing with no status at all — a
  // killed child is a false red, which is the very thing this file is meant to
  // stop producing. Serial keeps the original execution shape; only the budget it
  // consumes moved.
  beforeAll(async () => {
    for (const [name, command] of playwrightScripts) listings.set(name, await list(command));
  }, 300_000);

  it("has lanes to check, so the loop below is not vacuous", () => {
    expect(playwrightScripts.length).toBeGreaterThanOrEqual(5);
  });

  it("captured a listing for every lane it claims to check", () => {
    // Guards the harness itself: a lane that never ran would otherwise make the
    // per-lane assertions below pass on `undefined`.
    expect([...playwrightScripts.map(([n]) => n)].filter((n) => !listings.has(n))).toEqual([]);
  });

  it.each(playwrightScripts)("%s", (name) => {
    const listing = listings.get(name);
    expect(listing, `no listing captured for npm run ${name}`).toBeDefined();
    const { stdout, failure, status } = listing!;
    if (failure !== undefined) {
      expect.fail(
        `npm run ${name} does not parse (exit ${status ?? "?"}):\n${failure.trim().split("\n").slice(0, 4).join("\n")}`
      );
    }
    // Parsing succeeded; it must also have found work. `--list` prints a total,
    // and a lane that selects zero tests is the other half of this bug class.
    const total = /Total:\s*(\d+)\s+test/.exec(stdout)?.[1];
    expect(Number(total ?? -1), `npm run ${name} selected no tests:\n${stdout.slice(0, 300)}`).toBeGreaterThanOrEqual(
      0
    );
    expect(Number(total), `npm run ${name} lists 0 tests`).toBeGreaterThan(0);
  });
});
