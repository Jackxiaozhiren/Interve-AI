// The write gate made two login paths genuinely different in capability: an OAuth
// identity persists, the demo email/password identity does not (stampOwner
// refuses ownerless content writes). A UI that presents them as equivalent options
// with the same visual weight now makes a false claim, so both entry pages caption
// the provider group with what it saves and label the form under it 或用演示账号(不保存数据).
//
// Corrected 2026-10-13. The first version of this header went on to say that
// signup/page.tsx "offers no OAuth at all", so that anyone registering there
// could not save anything. The file contradicts that: it imports signInWithOAuth
// (src/app/signup/page.tsx:13) and redirects through it
// (src/app/signup/page.tsx:41), which is what makes the 都会保存 caption above
// those buttons true. The premise had rotted, not the rule — and the thing it rotted
// into is why the last arm below exists. Signup's provider buttons were once a fake
// (both called login() with a hardcoded oauth_user@example.com and never touched
// Supabase; src/app/signup/page.tsx:33 records it), and only
// LoginForm's OAuth entry point was pinned. A minted identity behind a Google button
// on /signup would have passed every arm in this file.
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

  // Signup is the page a new candidate lands on first, so whichever way it opens an
  // account has to be said out loud: either a real provider redirect or a local/demo
  // identity. The disjunction is deliberate — the page may legitimately ship one or
  // the other, but not neither, and not one while calling it the other.
  it("does not offer signup as an account without saying what it is", () => {
    const signup = read("src/app/signup/page.tsx");
    const hasOAuth = /signInWithOAuth/.test(signup);
    const saysLocal = /(不会?保存|仅保存|本地|演示|demo|local only)/i.test(signup);
    expect(hasOAuth || saysLocal, "signup must either offer OAuth or state that the account is local/demo").toBe(true);
  });

  it("opens a real provider session wherever it advertises a provider", () => {
    // The caption above the provider buttons promises that records, reports and
    // replays are saved. That is only true because the redirect is real: /signup
    // shipped this as a fake once, with both buttons calling login() on a hardcoded
    // oauth_user@example.com, so the account was a demo identity wearing a Google
    // logo and shared one email with every other "OAuth" signup. Reading the handler
    // rather than the file is what makes this bite — an import line alone satisfies
    // the arm above, and satisfied this one too before it existed.
    for (const [page, path] of [["/signup", "src/app/signup/page.tsx"], ["/login", "src/components/auth/LoginForm.tsx"]] as const) {
      const source = read(path);
      const handler = /const handleOAuth\w+ =[^{]*\{[\s\S]*?\n  \};/.exec(source)?.[0] ?? "";
      expect(handler, `${page} has no handleOAuth* handler to read`).not.toBe("");
      expect(handler, `${page} advertises a provider but no longer redirects through signInWithOAuth`).toMatch(/await signInWithOAuth\(\s*provider\s*\)/);
      expect(handler, `${page} mints a client-side identity behind a provider button`).not.toMatch(/login\(\s*\{/);
    }
  });
});
