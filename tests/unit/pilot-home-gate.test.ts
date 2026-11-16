/**
 * The private-pilot home gate, pinned where it is declared.
 *
 * 2026-11-16 (EE1/FF1, U9-a). The proxy behaviour itself is exercised by
 * tests/integration/proxy-guard.test.ts through the real proxy(). This file
 * owns the declarations that a behaviour-only test cannot see:
 *
 * - both switches must default closed in the shipped config (an env.example
 *   that sets either to '1' is a public site with a private-pilot label);
 * - the e2e webServer must opt in, or the landing/a11y/visual/keyboard lanes
 *   silently start testing a /login redirect instead of the homepage;
 * - robots.ts keeps one rule for the whole site, so no page can be advertised
 *   as indexable while the home gate is closed.
 *
 * Text assertions are used deliberately: these are configuration surfaces,
 * not runtime values, and the point is to fail when a human edits the wrong
 * line (e.g. shipping ALLOW_PUBLIC_HOME=1 in .env.example).
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import robots from "../../src/app/robots";

const read = (rel: string) => readFileSync(new URL(`../../${rel}`, import.meta.url), "utf8");

const envExample = read(".env.example");
const playwrightConfig = read("playwright.config.ts");
const proxySrc = read("src/proxy.ts");

describe("pilot home gate ships closed", () => {
  it("declares ALLOW_PUBLIC_HOME unset in .env.example", () => {
    const match = /^ALLOW_PUBLIC_HOME=(.*)$/m.exec(envExample);
    expect(match, ".env.example no longer mentions ALLOW_PUBLIC_HOME — retarget this arm").toBeTruthy();
    expect(match![1].trim(), "shipping the home gate open contradicts the private pilot").toBe("");
  });

  it("keeps ALLOW_PUBLIC_SIGNUP unset too — one open switch reopens the pilot", () => {
    const match = /^ALLOW_PUBLIC_SIGNUP=(.*)$/m.exec(envExample);
    expect(match, ".env.example no longer mentions ALLOW_PUBLIC_SIGNUP").toBeTruthy();
    expect(match![1].trim()).toBe("");
  });

  it("opts the Playwright webServer into both switches", () => {
    // The lanes navigate to the anonymous homepage and the signup form; if
    // either switch is dropped from this env the specs fail on a redirect
    // rather than on what they were written to measure.
    const envBlock = playwrightConfig.slice(playwrightConfig.indexOf("env: {", playwrightConfig.indexOf("webServer")));
    const tail = envBlock.slice(0, envBlock.indexOf("},"));
    expect(tail).toContain("ALLOW_PUBLIC_HOME: '1'");
    expect(tail).toContain("ALLOW_PUBLIC_SIGNUP: '1'");
  });

  it("reads both switches from process.env, not a compile-time constant", () => {
    // A literal `const ALLOW_PUBLIC_HOME = true` would satisfy the e2e lane
    // and reopen production at the same time. Pin the runtime lookup.
    expect(proxySrc).toMatch(/process\.env\.ALLOW_PUBLIC_HOME\s*!==\s*'1'/);
    expect(proxySrc).toMatch(/process\.env\.ALLOW_PUBLIC_SIGNUP\s*!==\s*'1'/);
  });
});

describe("home gate and crawl policy agree", () => {
  it("keeps the whole site disallowed — no indexed page contradicts the gate", () => {
    const rules = robots().rules;
    const flat = Array.isArray(rules) ? rules : [rules];
    expect(flat.some((r) => (Array.isArray(r.disallow) ? r.disallow : r.disallow ? [r.disallow] : []).includes("/"))).toBe(true);
    expect(flat.some((r) => r.allow !== undefined)).toBe(false);
  });

  it("tags login redirects so a gated homepage does not lose noindex", () => {
    // ADJ-16 regression: the first cut of the home gate reused a bare
    // NextResponse.redirect, which turned '/' from "200 + noindex" into
    // "307 + no header". The tag must live on the shared redirect helper.
    const helper = proxySrc.slice(proxySrc.indexOf("function loginRedirect"), proxySrc.indexOf("export function proxy"));
    expect(helper).toContain("X-Robots-Tag");
    expect(helper).toContain("noindex, nofollow");
  });
});
