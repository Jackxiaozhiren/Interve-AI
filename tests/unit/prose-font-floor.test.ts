/**
 * Running text has a size floor; badges do not.
 *
 * `CameraSelfView`'s mic-hint paragraph rendered at `text-[9px]` — 6.75pt — and it is
 * the sentence that tells a candidate their video is not being looked at, which is the
 * one line in that overlay a nervous user has to actually read. `LiveStats` carried the
 * same size on the strain caption and on both "Basis in your answer" quotations, i.e. on
 * the text that makes the scoring auditable. Contrast was never the problem (measured:
 * white on the `bg-black/70` chip resolves to ~8.9:1, slate-500 on white is 4.76:1), so
 * `color-contrast` cannot see any of it and the axe lane reported four clean paragraphs.
 *
 * The floor is 11px, and it is the repo's own number rather than an invention: 58 sites
 * already use `text-[11px]`, and the next step up the scale (`text-xs`, 12px) is used 128
 * times, so a paragraph at 11px is inside the house size range instead of a new rule.
 *
 * What this deliberately does not police is the `<span>` badge population — the uppercase
 * `text-[9px]` chips in `LiveStats`, `StarTracker`, `TelemetryWidget`, `EvaluationView`
 * and the chat model selector. Those are labels on controls, a different typographic
 * object, and a repo-wide font-size gate is the design-system decision
 * `docs/audit/V11_REGISTER.md` V11-11 says has not been authorised. Narrowing the rule to
 * paragraphs is what makes it checkable today; the exclusion is named here rather than
 * smuggled in as a path list, and GFX3 below is the witness that the rule really reads
 * paragraph tags.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";
import { walkRepo } from "./repo-tree";

const FLOOR = 11;

type Para = { file: string; line: number; px: number; classes: string };

const collect = (files: string[]): { paragraphs: number; underFloor: Para[] } => {
  const underFloor: Para[] = [];
  let paragraphs = 0;
  for (const f of files) {
    const src = readFileSync(path.resolve(process.cwd(), f), "utf8");
    const sf = ts.createSourceFile(f, src, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    const visit = (n: ts.Node) => {
      const el = ts.isJsxElement(n) ? n.openingElement : ts.isJsxSelfClosingElement(n) ? n : null;
      if (el && el.tagName.getText(sf) === "p") {
        paragraphs++;
        const attr = el.attributes.properties.find(
          (p) => ts.isJsxAttribute(p) && p.name.getText() === "className"
        ) as ts.JsxAttribute | undefined;
        // Every literal in the initialiser counts, including the branches of a
        // conditional template string: an arbitrary size can arrive either way.
        const text = attr?.initializer ? attr.initializer.getText(sf) : "";
        for (const m of text.matchAll(/text-\[(\d+(?:\.\d+)?)px\]/g)) {
          const px = Number(m[1]);
          if (px < FLOOR) {
            underFloor.push({
              file: f,
              line: sf.getLineAndCharacterOfPosition(el.getStart(sf)).line + 1,
              px,
              classes: text.replace(/\s+/g, " ").slice(0, 80),
            });
          }
        }
      }
      ts.forEachChild(n, visit);
    };
    visit(sf);
  }
  return { paragraphs, underFloor };
};

const CENSUS = collect(walkRepo("src", (rel) => rel.endsWith(".tsx")));

// An independent read of the same population, deliberately by a different method: a
// count-only floor cannot fail for a widened matcher, because `span` is more common
// than `p` and a guard that matched badges instead of prose would still report
// hundreds of elements and stay green (GFX2 proved exactly that). The two counts
// agreeing is the check; either one going alone is not.
const TEXT_PARAGRAPHS = walkRepo("src", (rel) => rel.endsWith(".tsx")).reduce(
  (n, f) => n + (readFileSync(path.resolve(process.cwd(), f), "utf8").match(/<p[\s>]/g)?.length ?? 0),
  0
);

describe("paragraph text keeps a readable floor", () => {
  it(`the census counts the paragraphs that are there (${CENSUS.paragraphs} by AST, ${TEXT_PARAGRAPHS} by text)`, () => {
    expect(
      CENSUS.paragraphs,
      "expected at least 150 <p> elements in src/ — the walk is not finding prose, so the floor below checks nothing"
    ).toBeGreaterThanOrEqual(150);
    expect(
      TEXT_PARAGRAPHS,
      "the text count collapsed, so this differential is comparing the AST against nothing"
    ).toBeGreaterThanOrEqual(150);
    expect(
      CENSUS.paragraphs,
      `the AST walk found ${CENSUS.paragraphs} paragraphs and the text read found ${TEXT_PARAGRAPHS}: the rule is not looking at the population it names`
    ).toBe(TEXT_PARAGRAPHS);
  });

  it(`no paragraph renders below ${FLOOR}px`, () => {
    expect(
      under(CENSUS.underFloor),
      `text below ${FLOOR}px on a paragraph is not legible running copy, whatever its contrast measures (V11-11)`
    ).toEqual([]);
  });

  it("the badge population is excluded by tag, not by path", () => {
    // Guards the exclusion above against becoming an accident: `text-[9px]` must still
    // exist in src/, on non-paragraph tags. If this ever goes empty the rule has been
    // widened, and the design-system authorisation V11-11 names is the thing to get.
    const badges = readFileSync(path.resolve(process.cwd(), "src/components/interview/LiveStats.tsx"), "utf8");
    expect(badges, "LiveStats no longer carries the uppercase 9px chips this rule excludes").toMatch(/text-\[9px\]/);
  });
});

const under = (list: Para[]) => list.map((p) => `${p.file}:${p.line} text-[${p.px}px] — ${p.classes}`);
