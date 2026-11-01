// P0-3 (PRD F-1 §1–§3) — the front door speaks to the person being interviewed.
//
// The page that greeted a candidate said, in its own words, "帮助您准确评估候选人
// 能力，发掘顶尖人才" and "帮助企业高效筛选高匹配度人才". That is a buyer's
// sentence on a candidate's product: the reader cannot tell whether they opened a
// practice tool or a screening tool, and §1.2 principle 2 says the reader is the
// person being assessed. This guard is the part that cannot drift back — copy
// reviews do not scale, and the previous version had survived several of them.
//
// Scope is the two marketing surfaces (`/` composed from src/components/home, and
// the near-duplicate /landing), not the whole app: the report legitimately writes
// about 候选人 in its disclaimers, and a guard that fires there would be turned
// off within a week.
import { describe, expect, it } from "vitest";
import { readRepo, walkRepo } from "./repo-tree";

const MARKETING_SURFACES = [
  ...walkRepo("src/components/home", (rel) => rel.endsWith(".tsx")),
  "src/app/landing/page.tsx",
];

/**
 * Words that only make sense to somebody hiring. Matched on live source lines
 * with comments skipped, the same way tests/integration/prohibitions.test.ts
 * does — a removal note describing the old copy must not re-trigger the alarm.
 */
const BUYER_WORDS: { pattern: RegExp; why: string }[] = [
  { pattern: /招聘/, why: "the product does not run recruiting" },
  { pattern: /筛选/, why: "screening is the other side of the table" },
  { pattern: /人才/, why: "'talent' is what a company acquires, not what you practise" },
  { pattern: /企业/, why: "there is no enterprise product" },
  { pattern: /雇主/, why: "the reader is not an employer" },
  { pattern: /候选人/, why: "the second person is the reader; use 你" },
];

/**
 * Live copy only: block comments (including the JSX `{/* … *\/}` notes that
 * explain why a string was removed) are stripped before scanning, and whole-line
 * `//` comments are dropped. Without the first step this guard fires on the note
 * that documents the removal — and a guard that punishes its own documentation
 * gets deleted, not obeyed.
 */
function liveLines(rel: string): { text: string; line: string }[] {
  const withoutBlocks = readRepo(rel).replace(/\/\*[\s\S]*?\*\//g, "");
  return withoutBlocks
    .split("\n")
    .map((raw) => ({ text: raw, line: raw.trim() }))
    .filter(({ line }) => line.length > 0 && !line.startsWith("//"));
}

describe("the home page addresses the candidate", () => {
  it("names no buyer anywhere on the marketing surfaces", () => {
    const hits: string[] = [];
    for (const file of MARKETING_SURFACES) {
      for (const { text, line } of liveLines(file)) {
        for (const { pattern, why } of BUYER_WORDS) {
          if (pattern.test(text)) hits.push(`${file}: ${line.slice(0, 100)}  ← ${why}`);
        }
      }
    }
    expect(hits).toEqual([]);
  });

  it("says what the reader gets, not what the platform is", () => {
    const hero = readRepo("src/components/home/HeroSection.tsx");
    // The promise in F-1 §1, in the words F-1 §1 uses.
    expect(hero).toMatch(/能照着改的复盘/);
    // And it must be visible without scrolling past a slogan: the h1 carries it.
    const h1 = hero.match(/<h1[\s\S]*?<\/h1>/)?.[0] ?? "";
    expect(h1, "the promise lives in the h1, not only in a paragraph").toMatch(/复盘/);
  });

  it("offers one primary way in, and it starts a session rather than a chat", () => {
    const hero = readRepo("src/components/home/HeroSection.tsx");
    expect(hero).toMatch(/开始练一场/);
    // /chat is a conversation surface, not the interview; the practice path is
    // /setup.
    expect(hero).toMatch(/href="\/setup"/);
    expect(hero, "the hero no longer leads with the chat surface").not.toMatch(/href="\/chat"/);
  });

  it("does not promise practice without an account, which this build cannot do", () => {
    const hero = readRepo("src/components/home/HeroSection.tsx");
    // Measured in a browser on 2026-11-01 against the local build: /setup answers
    // /login?from=/setup for an anonymous visitor (the guard lives in proxy.ts, not
    // middleware.ts — which is how the first version of this CTA came to promise
    // "不要求先注册"). PRD F-1 §2 does ask for signup-free practice; that is a guest
    // session in B-1, not a copy change. Until it exists, the hero must say the
    // account is required, because §1.2 principle 3 forbids claiming the unbuilt.
    expect(hero, "the hero must not claim signup-free practice").not.toMatch(/免注册|无需注册|不要求先注册/);
    expect(hero, "the hero must say an account is required").toMatch(/登录/);
  });
});
