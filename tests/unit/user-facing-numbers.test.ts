/**
 * Every digit a user reads must have an owner.
 *
 * `no-unverifiable-claims.test.ts` forbids a fixed list of phrases, which means a
 * new invented number passes silently. This guard inverts it: it walks the parse
 * tree for what a reader can actually see — JSX text and string children of
 * elements, never attributes, never `className`, never the values interpolated
 * from code — and requires that any file printing a literal digit is allowlisted
 * with the code that backs it.
 *
 * It found three things on its first run, all user-facing:
 *   * `/dashboard/interview` rendered "本周已完成 3 次模拟面试，综合得分上升 5%" as
 *     static copy — a fabricated personal statistic on a page whose buttons do
 *     nothing;
 *   * the Speaking Rate card asserted `Optimal: 120-150` while the report page
 *     advised against a `100–160 参考带`;
 *   * `/dashboard/resume` promised "PDF, DOCX, 或 TXT，最大 10MB" while
 *     `parse-resume` accepts only PDF and images and refuses anything over 5MB,
 *     so the formats it named could not be uploaded at all.
 * The first two are fixed in this change (the band now has one owner,
 * `WPM_REFERENCE_BAND`; the stat is gone). The third is fixed by deriving the
 * copy from `MAX_RESUME_MB`.
 *
 * `OPEN` is the honest remainder: claims a check cannot yet settle because they
 * need a product decision, not a code change. Its size is asserted, so the list
 * can only shrink, and a new unbacked number cannot join it silently.
 */
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import ts from "typescript";
import { describe, expect, it } from "vitest";
import { MAX_RESUME_MB } from "@/lib/uploads";
import { WPM_REFERENCE_BAND } from "@/lib/interview/delivery-metrics";

const DIGIT = /\d+(?:\.\d+)?/g;

/** Literal digits a reader can see in a file, via the parse tree. */
function visibleDigits(file: string): string[] {
  const text = readFileSync(file, "utf8");
  const sf = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const found = new Set<string>();
  const grab = (s: string) => {
    for (const m of s.matchAll(DIGIT)) found.add(m[0]);
  };
  const visit = (node: ts.Node) => {
    if (ts.isJsxText(node)) grab(node.getText(sf));
    if (ts.isJsxExpression(node) && node.expression && ts.isStringLiteral(node.expression)) grab(node.expression.text);
    node.forEachChild(visit);
  };
  visit(sf);
  return [...found].sort();
}

interface Entry {
  why: string;
  digits: string[];
}

/** Digits whose meaning is pinned to code in this repository. */
const VERIFIED: Record<string, Entry> = {
  "src/app/dashboard/page.tsx": {
    digits: ["100", "2"],
    why: "/100 is the readiness scale's denominator; 2 is `computeProgressInsights`'s own rule that improvementVelocity needs >= 2 scored sessions",
  },
  "src/app/dashboard/report/[id]/page.tsx": {
    digits: ["100", "3"],
    why: "/100 scale suffix; 'Step 3 · Review' is a step label, not a measurement",
  },
  "src/app/not-found.tsx": { digits: ["404"], why: "the HTTP status of the page it renders" },
  "src/app/practice/[id]/client.tsx": { digits: ["100"], why: "/100 scale suffix" },
  "src/app/privacy/page.tsx": {
    digits: ["003", "006", "24", "30", "4", "4.7"],
    why: "migration filenames that exist under supabase/migrations; 24h = SESSION_TTL_MS; 30 days = the retention both this page and session-persistence enforce; glm-4-flash / glm-4.7-flash = registry.ts model ids",
  },
  "src/app/setup/page.tsx": {
    digits: ["500"],
    why: "the 500-char truncation this page applies before storing jobDescription/context",
  },
  "src/app/terms/page.tsx": {
    digits: ["429"],
    why: "the status guardRequest returns when a rate limit trips",
  },
  "src/components/dashboard/ContinuousLearning.tsx": {
    digits: ["2"],
    why: "the same >= 2 scored sessions rule; the reference band is interpolated from WPM_REFERENCE_BAND, so it is not a literal here",
  },
  "src/components/dashboard/PrintableDossier.tsx": { digits: ["100"], why: "/100 scale suffix" },
  "src/components/dashboard/SessionDetailModal.tsx": { digits: ["100"], why: "/ 100 scale suffix" },
  "src/components/evaluation/EvaluationView.tsx": {
    digits: ["100", "5"],
    why: "/100 scale suffix and the rubric's 1-5 anchors (DimensionSchema: int().min(1).max(5))",
  },
  "src/components/home/PricingSection.tsx": { digits: ["0"], why: "¥0 — the app has no billing code and no paid tier" },
  "src/components/interview/PrintLayout.tsx": { digits: ["100"], why: "/100 scale suffix" },
  "src/components/setup/ResumeIntegrationSections.tsx": {
    digits: ["5"],
    why: "the upload cap, which is MAX_RESUME_MB and enforced by parse-resume",
  },
};

/** Claims that need an owner decision rather than a code change. May only shrink. */
const OPEN: Record<string, Entry & { needsOwner: string }> = {
  "src/app/dashboard/settings/page.tsx": {
    digits: ["30"],
    why: "'Get text message alerts 30 minutes before scheduled mock interviews' — there is no SMS provider, no phone number field, and no scheduler in the app",
    needsOwner: "remove the SMS Reminders row, or build the feature; a settings toggle that stores a preference nothing reads is a phantom capability",
  },
  "src/app/landing/page.tsx": {
    digits: ["2.0"],
    why: "'Interve AI 2.0 现已发布' while package.json says 1.0.0 and EVALUATION_VERSION 2.0 is the evaluation schema, not the product",
    needsOwner: "cut the version badge or start versioning the product; either way it should come from one place",
  },
  "src/components/home/HeroSection.tsx": {
    digits: ["2.0"],
    why: "same badge as /landing",
    needsOwner: "same decision as src/app/landing/page.tsx",
  },
};

const ALL = { ...VERIFIED, ...OPEN };

const files = execFileSync("git", ["ls-files", "src"], { encoding: "utf8" })
  .split("\n")
  .filter((f) => f.endsWith(".tsx"));

const measured: Record<string, string[]> = {};
for (const f of files) {
  const d = visibleDigits(f);
  if (d.length > 0) measured[f] = d;
}

const unexpected = Object.keys(measured).filter((f) => !(f in ALL));
const stale = Object.keys(ALL).filter((f) => !(f in measured));

describe("user-visible digits have an owner", () => {
  it("reads real copy out of the parse tree (instrument sanity)", () => {
    expect(files.length, "no tsx files found — the scan would be vacuous").toBeGreaterThan(100);
    expect(Object.keys(measured).length).toBeGreaterThanOrEqual(15);
    // Attributes are not copy: a class like `text-[3.5rem]` must not appear.
    expect(JSON.stringify(measured)).not.toContain("3.5");
    // And JSX text is: the scale denominator does.
    expect(measured["src/app/dashboard/page.tsx"]).toContain("100");
  });

  it("names every file that prints a digit, and no file that no longer does", () => {
    expect(unexpected, `unallowlisted digits in ${unexpected.join(", ")}`).toEqual([]);
    expect(stale, `allowlist entries with no digits left: ${stale.join(", ")}`).toEqual([]);
  });

  it.each(Object.entries(ALL))("%s prints exactly the digits its entry claims", (file, entry) => {
    expect(measured[file]).toEqual(entry.digits);
  });

  it("keeps the unadjudicated list from growing", () => {
    expect(Object.keys(OPEN).length).toBeLessThanOrEqual(3);
    for (const [file, entry] of Object.entries(OPEN)) {
      expect(entry.needsOwner, `${file} is OPEN but says what the owner must decide`).not.toBe("");
    }
  });

  it("checks the two numbers that have constants, rather than trusting the text", () => {
    expect(MAX_RESUME_MB).toBe(5);
    expect(WPM_REFERENCE_BAND).toEqual({ low: 100, high: 160 });
    // The only place a band is written into copy must be the owner's own numbers.
    expect(readFileSync("src/components/dashboard/ContinuousLearning.tsx", "utf8")).not.toMatch(/Optimal:\s*\d/);
  });
});
