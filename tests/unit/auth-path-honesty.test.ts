// The write gate made two login paths genuinely different in capability: an OAuth
// identity persists, the demo email/password identity does not (stampOwner
// refuses ownerless content writes). A UI that presents them as equivalent options
// with the same visual weight now makes a false claim, and signup/page.tsx offers
// no OAuth at all — so someone who registers there cannot save anything and has no
// way to discover that.
//
// This is the same truthfulness rule the repo already enforces for AI output,
// applied to our own product copy. Pins are behavioural, not pixel-level: any
// wording that states the difference satisfies them.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

const ROOT = new URL("../../", import.meta.url);
const read = (p: string) => readFileSync(new URL(p, ROOT), "utf8");

describe("login paths state what actually differs", () => {
  const form = read("src/components/auth/LoginForm.tsx");

  it("names persistence as the difference between the two paths", async () => {
    const mentionsSave = /(不会?保存|仅保存在|不持久化|no.*sav|not.*persist|本地)/i.test(form);
    expect(mentionsSave, "LoginForm must tell demo users their session will not be saved").toBe(true);
  });

  it("offers an account path and marks it as the saving one", () => {
    expect(form.match(/signInWithOAuth/), "OAuth entry point removed").toBeTruthy();
    // Assert on the caption text itself, not on adjacency: the label sits above
    // the buttons and Tailwind class strings are long, so a character window
    // between the two measures markup, not meaning.
    const captions = [...form.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/g)]
      .map((m) => m[1].replace(/<[^>]+>/g, "").trim());
    expect(
      captions.some((c) => /账号/.test(c) && /保存|历史|报告/.test(c)),
      `no caption ties the account path to persistence: ${JSON.stringify(captions)}`
    ).toBe(true);
  });

  // Signup is the page a new candidate lands on first; today it can only create a
  // demo identity, which cannot persist. Silence here is the misleading part.
  it("does not offer signup as an account without saying what it is", () => {
    const signup = read("src/app/signup/page.tsx");
    const hasOAuth = /signInWithOAuth/.test(signup);
    const saysLocal = /(不会?保存|仅保存|本地|演示|demo|local only)/i.test(signup);
    expect(hasOAuth || saysLocal, "signup must either offer OAuth or state that the account is local/demo").toBe(true);
  });
});
