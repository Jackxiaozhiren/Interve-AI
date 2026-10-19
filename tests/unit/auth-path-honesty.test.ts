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
//
// Moved again on 2026-10-19, and the arms follow the wiring rather than the page:
// both doors now render one shared component, src/components/auth/oauth-buttons.tsx,
// so `signInWithOAuth` and the handler that calls it live there and the pages
// reference the component. That is one implementation of the promise, which is
// what these arms should be reading — the file they used to read was the copy that
// Sonar scored as 3.7% duplicated new code.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

const ROOT = new URL("../../", import.meta.url);
const read = (p: string) => readFileSync(new URL(p, ROOT), "utf8");

const DOOR = "src/components/auth/oauth-buttons.tsx";

/** The handler inside the shared door, read as a unit rather than as a file. */
function doorHandler(source: string): string {
  return /const press = useCallback\(\s*async \(provider: Provider\) => \{[\s\S]*?\n {4}\},/.exec(source)?.[0] ?? "";
}

describe("login paths state what actually differs", () => {
  const form = read("src/components/auth/LoginForm.tsx");
  const door = read(DOOR);

  it("names persistence as the difference between the two paths", async () => {
    const mentionsSave = /(不会?保存|仅保存在|不持久化|no.*sav|not.*persist|本地)/i.test(form);
    expect(mentionsSave, "LoginForm must tell demo users their session will not be saved").toBe(true);
  });

  it("offers an account path and marks it as the saving one", () => {
    // Rendering the door is what advertises an account path; the door is what
    // makes it real. Both halves have to be present, and neither is satisfied by
    // a string in the page — the page no longer contains the entry point at all.
    expect(form, "LoginForm no longer renders the provider door").toContain("OAuthProviderButtons");
    expect(door.match(/signInWithOAuth/), "the provider entry point is gone from the door").toBeTruthy();
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
    const hasOAuth = /OAuthProviderButtons/.test(signup);
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
    const handler = doorHandler(door);
    expect(handler, `${DOOR} has no press handler to read`).not.toBe("");
    expect(handler, "the door advertises a provider but no longer redirects through signInWithOAuth").toMatch(/await signInWithOAuth\(\s*provider\s*\)/);
    expect(handler, "the door mints a client-side identity behind a provider button").not.toMatch(/login\(\s*\{/);
    // …and every page that advertises one has to be the page rendering that door.
    for (const [page, path] of [["/signup", "src/app/signup/page.tsx"], ["/login", "src/components/auth/LoginForm.tsx"]] as const) {
      expect(read(path), `${page} advertises providers without rendering the door that opens them`).toContain("OAuthProviderButtons");
    }
  });

  it("reads the handler it claims to read", () => {
    // The arm above is only as good as this extractor, so it gets a positive and a
    // negative control against text rather than against the shipped file.
    expect(doorHandler(door), "the extractor misses the shipped handler").toContain("signInWithOAuth");
    expect(doorHandler("export function NotADoor() { return null; }")).toBe("");
  });
});
