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
 * count without starting a browser, so the whole check costs about a second per
 * lane.
 */
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

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

describe("the Playwright lanes are runnable commands", () => {
  it("has lanes to check, so the loop below is not vacuous", () => {
    expect(playwrightScripts.length).toBeGreaterThanOrEqual(5);
  });

  it.each(playwrightScripts)("%s", (name, command) => {
    const args = argv(command).slice(1); // drop the leading `playwright`
    let stdout = "";
    try {
      stdout = execFileSync("npx", ["playwright", "test", "--list", ...args], {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
      });
    } catch (error) {
      const e = error as { stdout?: string; stderr?: string; status?: number };
      const text = `${e.stdout ?? ""}${e.stderr ?? ""}`;
      expect.fail(
        `npm run ${name} does not parse (exit ${e.status ?? "?"}):\n${text.trim().split("\n").slice(0, 4).join("\n")}`
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
