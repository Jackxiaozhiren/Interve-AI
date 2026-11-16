// G1 deploy-consistency pins (static, $0).
//
// V5 G1: vercel.json vs output:standalone consistency belongs in CI;
// Dockerfile base must track engines.node; robots must match the current
// launch surface. That surface changed on 2026-11-15 (W1): the private pilot
// closes the crawl surface instead of publishing marketing + auth pages.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import robots from "../../src/app/robots";

const root = (p: string) => readFileSync(fileURLToPath(new URL(`../../${p}`, import.meta.url)), "utf8");

describe("deploy consistency (G1)", () => {
  it("vercel.json does not fight output:standalone", () => {
    const vercel = JSON.parse(root("vercel.json")) as Record<string, unknown>;
    // Standalone is a Docker concern; Vercel builds natively. Any `output`
    // or custom build/output keys here would silently fork the two paths.
    expect(vercel, "vercel.json output key").not.toHaveProperty("output");
    expect(vercel, "vercel.json builds key").not.toHaveProperty("builds");
    expect(root("next.config.ts"), "standalone").toContain("output: 'standalone'");
  });

  it("Dockerfile base tracks engines.node (24)", () => {
    const docker = root("Dockerfile");
    const pkg = JSON.parse(root("package.json")) as { engines: { node: string } };
    expect(pkg.engines.node).toContain("24");
    expect(docker.split("\n")[0]).toMatch(/^FROM node:24/);
    expect(docker, "non-root").toContain("USER nextjs");
  });

  it("every surface installs from the lockfile, none re-resolves it", () => {
    // `npm install` writes package-lock.json; `npm ci` refuses to. CI and the
    // image both installed from the lockfile, while vercel.json was checked in
    // with `npm install` — so the tree Vercel published could differ from the
    // tree CI certified, silently, whenever a range resolved to something new.
    // The surfaces are read from their own files rather than restated here, so
    // a drift on either side goes red instead of this arm agreeing with itself.
    const vercel = JSON.parse(root("vercel.json")) as { installCommand?: string };
    expect(typeof vercel.installCommand, "vercel.json names no install command").toBe("string");

    const ciInstalls = [...root(".github/workflows/ci.yml").matchAll(/^\s*- run: (npm (?:ci|install)[^\n]*)$/gm)].map((m) => m[1] ?? "");
    expect(ciInstalls.length, "no CI install step was read — this arm would pass on blindness").toBeGreaterThanOrEqual(2);

    const surfaces: [string, string][] = [["vercel.json", vercel.installCommand ?? ""], ...ciInstalls.map((c, i): [string, string] => [`ci.yml install step ${i + 1}`, c])];
    for (const [where, cmd] of surfaces) {
      expect(cmd, `${where} installs with "${cmd}", which can rewrite the lockfile the build is supposed to reproduce`).toMatch(/^npm ci(\s|$)/);
    }

    // The image reaches `npm ci` through a branch, so pin the branch rather
    // than the word: without a lockfile present it must not claim to install
    // reproducibly.
    expect(root("Dockerfile"), "the image's lockfile branch").toMatch(/-f package-lock\.json \]; then npm ci/);
    expect(root("package-lock.json"), "npm ci needs a lockfile").toContain("\"lockfileVersion\"");
  });

  it("the README names the install command Vercel actually runs", () => {
    // The paragraph that tells a newcomer how this is deployed said
    // `vercel.json`: `npm install` after vercel.json had been changed to `npm ci`
    // (PR #116). Every arm above reads a config file, so the drift was visible only
    // to a human comparing prose — and the prose is what a deployer follows.
    //
    // The claim is read out of README.md and compared against the value vercel.json
    // carries, so this arm cannot agree with itself: it fails if the README changes
    // and fails if vercel.json changes without the sentence coming along.
    const claimed = /`vercel\.json`:\s*`([^`]+)`/.exec(root("README.md"))?.[1];
    expect(claimed, "README no longer states a Vercel install command — retarget this arm").toBeTruthy();

    const vercel = JSON.parse(root("vercel.json")) as { installCommand?: string };
    expect(claimed, `README says Vercel runs "${claimed}", vercel.json says "${vercel.installCommand}"`).toBe(
      vercel.installCommand
    );
  });

  // 2026-11-15 (W1): the private pilot closes the crawl surface. Assert on the
  // returned object, not on the source text — the file's comments legitimately
  // mention /signup and /landing while the rule allows nothing, so a text match
  // would pass for the wrong reason in both directions.
  it("robots closes the whole crawl surface during the private pilot", () => {
    const rules = robots().rules;
    const flat = Array.isArray(rules) ? rules : [rules];
    expect(flat, "one rule set").toHaveLength(1);
    const rule = flat[0];
    expect(rule).toBeDefined();
    if (!rule) throw new Error("robots() returned no rule");
    expect(String(rule.userAgent)).toBe("*");
    expect(rule.disallow, "disallow everything").toEqual(["/"]);
    expect(rule.allow, "no allow-list while the pilot is private").toBeUndefined();

    // robots.txt stops fetches; it cannot remove an entry that is already
    // indexed. The header is the other half of the policy, so pin it where it
    // is actually emitted.
    expect(root("src/proxy.ts"), "X-Robots-Tag").toContain("X-Robots-Tag");

    // No sitemap: a sitemap advertises URLs, which is the opposite of this
    // policy. It stays ungenerated until the pilot ends.
    expect(robots(), "no sitemap field").not.toHaveProperty("sitemap");
  });
});
