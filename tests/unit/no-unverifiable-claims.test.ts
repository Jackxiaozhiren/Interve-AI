/**
 * Claims the product cannot support.
 *
 * A link that resolves is not the same as a label that is true: 企业版 pointed at
 * /recruiter, which is a screen of hardcoded candidates, and the closing CTA
 * promised a 14-day trial with no trial, plan or billing code anywhere. Those are
 * placeholders of a kind no anchor check can see, so they are pinned here as
 * text the codebase must not contain, and as text it must.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (rel: string) => readFileSync(new URL(`../../${rel}`, import.meta.url), "utf8");

const SOURCE_FILES: string[] = [];
(function walk(dir: string): void {
  for (const entry of readdirSync(new URL(`../../${dir}`, import.meta.url))) {
    const rel = `${dir}/${entry}`;
    if (statSync(new URL(`../../${rel}`, import.meta.url)).isDirectory()) walk(rel);
    else if (/\.tsx?$/.test(entry)) SOURCE_FILES.push(rel);
  }
})("src");

/**
 * Reduce a source file to what a user could actually see. JSX block comments are
 * stripped first because the removals are documented in place — a comment saying
 * 企业版 used to link here is history, not a claim — and this is the third time a
 * text scan in this repo has had to learn that comments are not copy.
 */
const prose = (f: string) =>
  read(f)
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, "")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n")
    .filter((l) => !/^\s*(\/\/|\*)/.test(l))
    .join("\n");

describe("no invented commercial claims", () => {
  const FORBIDDEN = [/14\s*天.*试用/, /免费试用/, /数百家/, /顶尖企业/];

  it("appear nowhere in user-visible source", () => {
    const hits = SOURCE_FILES.flatMap((f) => {
      const body = prose(f);
      return FORBIDDEN.filter((re) => re.test(body)).map((re) => `${f}: ${re}`);
    });
    expect(hits).toEqual([]);
  });

  it("are not hiding in a comment that re-states them as history", () => {
    // The filter above drops comment lines, so assert the pattern really is
    // absent from the shipped copy rather than merely unrendered.
    const cta = read("src/components/home/CtaSection.tsx");
    expect(cta).toMatch(/带原文证据的报告/);
    expect(cta).not.toMatch(/试用/);
  });
});

describe("the recruiter screen admits what it is", () => {
  const page = "src/app/recruiter/page.tsx";

  it("carries a demo notice in both languages", () => {
    const dict = read("src/lib/i18n/dictionaries.ts");
    const notices = [...dict.matchAll(/demoNotice:\s*"([^"]+)"/g)].map((m) => m[1]);
    expect(notices).toHaveLength(2);
    for (const n of notices) expect(n).toMatch(/demo|演示/i);
  });

  it("renders that notice rather than defining it and forgetting to show it", () => {
    expect(read(page)).toMatch(/t\.recruiter\.demoNotice/);
  });

  it("writes no evaluation rows against invented candidate ids", () => {
    // The handler used to persist notes keyed on mock ids like "C-105", filling a
    // real table with commentary about people who do not exist.
    const body = read(page);
    expect(body).not.toMatch(/db\.evaluations\.(add|update)\(/);
    expect(body).toMatch(/mockCandidates/);
  });

  it("has no button without a handler", () => {
    // 生成报告 was the page's headline action and did nothing when pressed.
    const body = read(page);
    expect(body).not.toMatch(/generateReport/);
  });
});

describe("the footers do not sell things that do not exist", () => {
  const files = ["src/components/layout/Footer.tsx", "src/app/landing/page.tsx"];

  it("never label the demo route as an enterprise edition", () => {
    for (const f of files) {
      const body = prose(f);
      expect(body, f).not.toMatch(/企业版/);
      expect(body, f).not.toMatch(/href="\/recruiter"/);
    }
  });

  it("do not offer a raw API endpoint as a resource link", () => {
    for (const f of files) expect(prose(f), f).not.toMatch(/href="\/api\//);
  });

  it("do not list the same destination twice under different columns", () => {
    for (const f of files) {
      const hrefs = [...prose(f).matchAll(/href="(\/[a-z-]+)"/gi)].map((m) => m[1].toLowerCase());
      const dupes = hrefs.filter((h, i) => hrefs.indexOf(h) !== i);
      expect(dupes, `${f} repeats ${dupes.join(", ")}`).toEqual([]);
    }
  });
});

describe("the terms page agrees with the product", () => {
  it("acknowledges the recruiter demo instead of only denying it exists", () => {
    const terms = read("src/app/terms/page.tsx");
    expect(terms).toMatch(/未接真实数据的演示/);
    expect(terms).toMatch(/不会.{0,6}被保存/);
  });
});

/**
 * The `/` route is the page a stranger actually lands on, and until this slice
 * it carried more invented proof than `/landing` ever did: 10,000+ active users,
 * 50,000+ completed interviews, a 95% satisfaction rate, a question bank of
 * "100+" that does not exist as data (prompts are generated per session), three
 * pricing tiers with no billing code behind any of them, and a testimonial
 * attributed to a named engineer at a named real employer. The employer and the
 * person are both invented, which is a different order of problem from a round
 * number — so these are pinned structurally, not phrase by phrase.
 */
describe("the homepage asserts nothing it cannot show", () => {
  const HOME = SOURCE_FILES.filter((f) => f.startsWith("src/components/home/"));

  it("renders no invented metric: no literal number carrying a + or % suffix", () => {
    // Derived values are safe here — StatsStrip interpolates a rate it read from
    // IndexedDB, so `${rate}%` contains no numeric literal to ban.
    const hits = HOME.flatMap((f) =>
      [...prose(f).matchAll(/([0-9][0-9,]*)\s*[+%]/g)].map((m) => `${f}: ${m[0]}`)
    );
    expect(hits).toEqual([]);
  });

  it("attributes no quote to a person", () => {
    const hits = HOME.filter((f) => /<blockquote/.test(prose(f)));
    expect(hits).toEqual([]);
  });

  it("names no employer alongside a person", () => {
    // The removed card read 李明 / 前端工程师 · 腾讯. A middle dot between a role
    // and a company is the shape of every byline in this file family.
    const hits = HOME.filter((f) => /·\s*[\u4e00-\u9fa5]{2,6}\s*(?:<|")/.test(prose(f)));
    expect(hits).toEqual([]);
  });

  it("offers exactly one price, because one price exists", () => {
    const body = prose("src/components/home/PricingSection.tsx");
    expect([...body.matchAll(/¥/g)]).toHaveLength(1);
  });

  it("puts no phantom tier or CTA in the slots that would carry one", () => {
    // Checked as structure, not as a whole-file substring ban: the section's own
    // disclaimer says out loud that 企业版 does not exist, and a guard that
    // indicts a honest negation gets routed around instead of obeyed. Tier names
    // live in <h3>, calls to action live in <InterveButton>.
    const body = prose("src/components/home/PricingSection.tsx");
    const tiers = [...body.matchAll(/<h3[^>]*>([^<]*)<\/h3>/g)].map((m) => m[1].trim());
    const ctas = [...body.matchAll(/<InterveButton[^>]*>([^<]*)<\/InterveButton>/g)].map((m) => m[1].trim());
    expect(tiers).toEqual(["免费"]);
    expect(ctas).toEqual(["免费注册"]);
    for (const label of [...tiers, ...ctas]) {
      expect(label).not.toMatch(/企业版|专业版|升级|联系销售/);
    }
  });

  it("has no billing surface for the copy to overreach into", () => {
    // If a checkout route ever lands, this fails and the pricing card gets
    // re-read — that is the point of checking the API surface and not only the prose.
    const api = SOURCE_FILES.filter((f) => f.startsWith("src/app/api/"));
    const billing = api.filter((f) => /billing|checkout|payment|subscription|upgrade/i.test(f));
    expect(billing).toEqual([]);
  });

  it("quotes the two numbers it shows from the code that owns them", () => {
    const body = read("src/components/home/PricingSection.tsx");
    expect(body).toMatch(/INTERVIEW_TYPES\.length/);
    expect(body).toMatch(/DEFAULT_USER_BUDGET_RPD/);
  });

  it("agrees with the budget module about the default ceiling", async () => {
    const { DEFAULT_USER_BUDGET_RPD, defaultUserBudget } = await import("@/lib/api/user-budget");
    expect(DEFAULT_USER_BUDGET_RPD).toBe(200);
    expect(defaultUserBudget()).toBe(DEFAULT_USER_BUDGET_RPD);
  });

  it("lists only interview types that actually exist", async () => {
    // No pin on the total: the card renders INTERVIEW_TYPES.length, so adding a
    // type keeps the copy true and a length assertion would only punish the work.
    const { INTERVIEW_TYPES } = await import("@/ai/interview/types");
    const ids = INTERVIEW_TYPES.map((t) => t.id);
    for (const id of ["behavioral", "technical", "system-design", "business-case"]) {
      expect(ids, id).toContain(id);
    }
  });
});
