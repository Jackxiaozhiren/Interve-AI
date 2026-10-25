/**
 * The house de-emphasis colour has to clear WCAG AA on every surface the design system
 * declares, and the residue of raw greys has to be the list this repo says it is.
 *
 * Two rules, both derived from files rather than transcribed:
 *
 *  1. `--muted-foreground` is read out of `src/app/globals.css`, and so is every surface
 *     token in the same `:root` block. Any token that is not itself a foreground is treated
 *     as a surface a de-emphasised label might sit on, so adding a new background to the
 *     theme joins this check without anyone remembering to widen it. Its scope is the theme's
 *     own surfaces and nothing else: a component fill like `bg-slate-100` is a palette colour,
 *     not a `:root` token, and Chrome resolves those to `lab()`/`oklab()`, so comparing them
 *     here would mean reimplementing a colour pipeline to audit a colour choice. Palette
 *     fills are covered where they are actually painted — the axe lane's `measuredFailuresOf`
 *     reads the ratio axe computed against the rendered background on every scanned route.
 *     That division is also why slate-600 rather than slate-500: slate-500 clears every
 *     surface in this file (4.76:1 on white) and would pass the rule below, yet it drops to
 *     4.34:1 on `slate-100`, which the app paints — it is the FlowMap step dot's fill. The
 *     theme check cannot see that and the lane can; the token was chosen from the pair.
 *  2. The raw `text-slate-400` sites still in `src/` must match
 *     `docs/audit/de-emphasis-residue.json` per file, in both directions. A new raw site
 *     goes red; so does resolving one without shrinking the inventory, which is what keeps
 *     the residue a ledger instead of a fossil.
 *
 * Counts are compared, never line numbers: those move when anything above them is edited,
 * and a colour guard that goes red because someone added an import is a colour guard people
 * learn to ignore. Comment text is stripped before counting, because a comment that names
 * the class is not a place the class is used — and after this sweep the difference is not
 * hypothetical: `grep -c` over `src/` returns a number one higher than the real residue,
 * from the comment in `setup/page.tsx` explaining what it used to be.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";
import { walkRepo } from "./repo-tree";

const CSS = readFileSync(path.resolve(process.cwd(), "src/app/globals.css"), "utf8");
const INVENTORY = JSON.parse(
  readFileSync(path.resolve(process.cwd(), "docs/audit/de-emphasis-residue.json"), "utf8")
) as { sites: Record<string, { count: number }> };

// WCAG contrast, written out rather than imported so a wrong dependency cannot quietly
// make every accessibility number in the repo wrong.
const channel = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const hexToRgb = (h: string) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const luminance = (rgb: number[]) =>
  0.2126 * channel(rgb[0] / 255) + 0.7152 * channel(rgb[1] / 255) + 0.0722 * channel(rgb[2] / 255);
const ratio = (a: string, b: string) => {
  const x = luminance(hexToRgb(a));
  const y = luminance(hexToRgb(b));
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
};

/** `--name: #rrggbb;` declarations, with the comment blocks that justify them removed. */
const cssVars = (src: string) => {
  const body = src.replace(/\/\*[\s\S]*?\*\//g, " ");
  const out = new Map<string, string>();
  for (const m of body.matchAll(/--([a-z0-9-]+):\s*(#[0-9a-fA-F]{6})\s*;/g)) out.set(m[1], m[2]);
  return out;
};

const VARS = cssVars(CSS);
const DE_EMPHASIS = VARS.get("muted-foreground");

/**
 * Surface tokens are the theme's light fill names that are not themselves a text colour.
 * Keyed on names the design system already uses, so `--color-chart-6` joining `:root` does
 * not silently widen or narrow this check by accident.
 */
const SURFACE_NAMES = ["background", "card", "muted", "secondary", "accent", "popover", "sidebar"];
const SURFACES = SURFACE_NAMES.filter((n) => VARS.has(n)).map((n) => ({ name: n, hex: VARS.get(n)! }));

/** Raw `text-slate-400` occurrences in code, by file. */
const rawSites = () => {
  const counts = new Map<string, number>();
  for (const f of walkRepo("src", (rel) => /\.(tsx|ts)$/.test(rel))) {
    const src = readFileSync(path.resolve(process.cwd(), f), "utf8");
    const sf = ts.createSourceFile(f, src, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    let n = 0;
    const visit = (node: ts.Node) => {
      // Only a JSX className carrying the utility counts as a use. Comments, prose and the
      // strings a test might carry are outside this node kind entirely.
      if (ts.isJsxAttribute(node) && node.name.getText() === "className" && node.initializer) {
        const text = node.initializer.getText(sf);
        for (const _ of text.matchAll(/text-slate-400\b/g)) n += 1;
      }
      ts.forEachChild(node, visit);
    };
    visit(sf);
    if (n) counts.set(f, n);
  }
  return counts;
};

describe("the de-emphasis colour is AA on every surface the theme declares", () => {
  it("the token and the surfaces are all present in globals.css", () => {
    // Without this, a rename would leave the loops below comparing nothing.
    expect(DE_EMPHASIS, "src/app/globals.css declares no --muted-foreground hex").toBeDefined();
    expect(SURFACES.length, `fewer than four surface tokens found: ${SURFACES.map((s) => s.name)}`).toBeGreaterThanOrEqual(4);
  });

  it("each surface is light enough to be a page background", () => {
    // The check is only meaningful if these are the surfaces text sits on. A dark one here
    // means the theme grew a dark surface and this rule's premise needs revisiting, not a
    // silently-passing comparison.
    for (const s of SURFACES) {
      expect(luminance(hexToRgb(s.hex)), `--${s.name} (${s.hex}) is not a light surface`).toBeGreaterThan(0.4);
    }
  });

  it("the de-emphasis colour clears 4.5:1 on every one of them", () => {
    const failures = SURFACES.map((s) => ({ ...s, got: Number(ratio(DE_EMPHASIS!, s.hex).toFixed(2)) })).filter(
      (s) => s.got < 4.5
    );
    expect(
      failures.map((f) => `--${f.name} ${f.hex}: ${f.got}:1`),
      `${DE_EMPHASIS} must clear 4.5:1 on every surface in the theme — slate-500 failed this by clearing white at 4.76 and dropping to 4.34 on slate-100`
    ).toEqual([]);
  });

  it("the colour is strictly darker than every surface it is compared against", () => {
    // A foreground that is lighter than its background inverts the reading; the ratio test
    // above would still pass. This catches the sign error that a ratio hides.
    const fg = luminance(hexToRgb(DE_EMPHASIS!));
    for (const s of SURFACES) {
      expect(luminance(hexToRgb(s.hex)) > fg, `--${s.name} is not lighter than the de-emphasis colour`).toBe(true);
    }
  });
});

describe("the raw-grey residue is the inventory this repo signed", () => {
  const counts = rawSites();
  const declared = new Map(Object.entries(INVENTORY.sites).map(([f, v]) => [f, v.count]));

  it("there is a residue to police", () => {
    const total = [...counts.values()].reduce((a, b) => a + b, 0);
    expect(total, "no raw text-slate-400 site found — either the residue is finished (delete this file and the rule) or the scan went blind").toBeGreaterThan(
      0
    );
    expect(declared.size, "the inventory names no file").toBeGreaterThan(0);
  });

  it("every raw site is declared", () => {
    const undeclared = [...counts].filter(([f, n]) => (declared.get(f) ?? 0) < n);
    expect(
      undeclared.map(([f, n]) => `${f}: ${n} found, ${declared.get(f) ?? 0} declared`),
      "a raw text-slate-400 appeared that docs/audit/de-emphasis-residue.json does not describe"
    ).toEqual([]);
  });

  it("no declaration is stale", () => {
    const stale = [...declared].filter(([f, n]) => (counts.get(f) ?? 0) < n);
    expect(
      stale.map(([f, n]) => `${f}: ${n} declared, ${counts.get(f) ?? 0} left`),
      "the inventory still counts sites that have been swept — shrink it"
    ).toEqual([]);
  });
});
