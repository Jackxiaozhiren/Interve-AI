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
