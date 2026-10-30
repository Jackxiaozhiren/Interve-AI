// The README's stack line named `next-pwa` long after the plugin was removed.
// next.config.ts records why (it emits no service worker under Turbopack, and
// every build path is a plain `next build`), the manifest no longer lists the
// dependency, and the build produces no `sw.js` — so the sentence was the only
// place the capability still existed.
//
// An absence assertion needs a reason it cannot rot: this one is deliberate, and
// re-adding the plugin means changing this test in the same commit as the plugin,
// which is the point. It is written against the whole file rather than the stack
// line so a claim cannot move somewhere the predicate does not look.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

const README = readFileSync("README.md", "utf8");

describe("the README does not claim a PWA capability the build does not produce", () => {
  it("names no PWA plugin", () => {
    expect(
      README.includes("next-pwa"),
      "README names next-pwa, but the plugin was removed and the build emits no service worker (next.config.ts:3-9). Restore the plugin or drop the claim.",
    ).toBe(false);
  });
});
