import { describe, expect, it } from "vitest";
import { ESLint } from "eslint";
import eslintConfig from "../../eslint.config.mjs";

// The lint gate is a CI step, so its most failure-prone property is not "does it
// find problems" but "does it start at all". Flat config resolves a `plugin/rule`
// reference only against plugins declared in an object that matches the same file,
// and `eslint-config-next` registers `jsx-a11y` only for the extensions in its own
// `files` glob (js, jsx, mjs, ts, tsx, mts, cts — note there is no `.cjs`). A
// `jsx-a11y/*` rule object with no `files` is therefore wider than the plugin that
// backs it: the first `.cjs` script in the tree makes `npm run lint` die during
// config load with "could not find plugin jsx-a11y", which reads like a rule
// problem and pushes a future maintainer toward deleting the rules to get green.
//
// These tests hold both edges: the config must survive every extension ESLint can
// be pointed at, and the a11y rules must still actually fire.

// ESLint's default lookup extensions plus everything eslint-config-next parses.
// `.cjs` is the one no upstream object registers `jsx-a11y` for, so it is the case
// that used to crash.
const PROBE_EXTENSIONS = ["js", "mjs", "cjs", "cts", "ts", "tsx", "jsx", "mts"];

const PLAIN_CODE = "export const value = 1;\n";
const JSX_CODE = "export const C = () => <div tabIndex={5}>hi</div>;\n";

const codeFor = (ext: string) => (ext === "tsx" || ext === "jsx" ? JSX_CODE : PLAIN_CODE);

const fatalMessages = (messages: { fatal?: boolean; message: string }[]) =>
  messages.filter((m) => m.fatal || /could not find plugin/i.test(m.message));

describe("eslint config loads for every extension the lint gate can be pointed at", () => {
  const eslint = new ESLint();

  it.each(PROBE_EXTENSIONS)("linting a probe %s file raises no config-load fatal", async (ext) => {
    const results = await eslint.lintText(codeFor(ext), { filePath: `probe.${ext}` });
    const fatals = fatalMessages(results[0]?.messages ?? []);
    expect(fatals.map((f) => f.message)).toEqual([]);
  });

  it("actually probed a non-trivial set of extensions", () => {
    // Without this, an emptied PROBE_EXTENSIONS would make the gate pass forever.
    expect(PROBE_EXTENSIONS.length).toBeGreaterThanOrEqual(8);
    expect(new Set(PROBE_EXTENSIONS).has("cjs")).toBe(true);
  });

  it("the repo's own tracked extensions are all covered by the probe set", async () => {
    const { execFileSync } = await import("child_process");
    const tracked = execFileSync("git", ["ls-files"], { encoding: "utf8" })
      .split("\n")
      .map((line) => /\.([a-z0-9]+)$/i.exec(line)?.[1]?.toLowerCase())
      .filter((ext): ext is string => Boolean(ext));
    const lintable = new Set(
      tracked.filter((ext) => ["js", "mjs", "cjs", "ts", "tsx", "jsx", "mts", "cts"].includes(ext)),
    );
    for (const ext of lintable) {
      expect(PROBE_EXTENSIONS).toContain(ext);
    }
  });
});

describe("the jsx-a11y rules this repo adds are enforced, not decorative", () => {
  const eslint = new ESLint();

  const ruleIdsFor = async (filePath: string, code: string) => {
    const results = await eslint.lintText(code, { filePath });
    return (results[0]?.messages ?? []).map((m) => m.ruleId);
  };

  it("tabindex-no-positive fires on a positive tabIndex", async () => {
    expect(await ruleIdsFor("probe.tsx", JSX_CODE)).toContain("jsx-a11y/tabindex-no-positive");
  });

  it("no-autofocus fires on a hard-wired autoFocus", async () => {
    expect(await ruleIdsFor("probe.jsx", "export const C = () => <input autoFocus />;\n")).toContain(
      "jsx-a11y/no-autofocus",
    );
  });

  it("heading-has-content fires on an empty heading", async () => {
    expect(await ruleIdsFor("probe.jsx", "export const C = () => <h1></h1>;\n")).toContain("jsx-a11y/heading-has-content");
  });

  it("every rule the config adds is still declared", () => {
    const added = eslintConfig
      .flatMap((entry) => (entry && typeof entry === "object" && "rules" in entry && entry.rules ? Object.keys(entry.rules) : []))
      .filter((rule) => rule.startsWith("jsx-a11y/"));
    expect(added.length).toBeGreaterThanOrEqual(7);
  });
});
