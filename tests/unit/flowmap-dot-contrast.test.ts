/**
 * The FlowMap step dot must be readable in every state it can render — and the
 * check has to survive the two things that hid it for its whole life.
 *
 * The dot is a `motion.div` whose fill and text colour are set through framer's
 * `animate` object rather than a Tailwind class, so axe reads the pair off the
 * computed style only when it decides the element is real text. With one or two
 * characters in it, it usually does not: on 2026-10-24 the room arm reported five
 * of these dots under "Element content is too short to determine if it is actual
 * text content", which is an `incomplete` — a measurement that never happened —
 * and no assertion anywhere looked at their colours. Sampling the painted pixel
 * behind the glyph found white on sky-500 at 2.77:1 and slate-500 on slate-100 at
 * 4.34:1, both under the 4.5:1 that 10px bold text needs. The comment above those
 * values claimed "#64748b (slate-500) meets 4.5:1 on the dot"; it had been
 * measured against pure white, and the dot's own background is slate-100.
 *
 * So this guard evaluates the two `animate` expressions for every state the dot
 * can actually be in, computes the WCAG ratio against the background that same
 * expression resolves to, and requires the AA threshold for the font size the
 * element declares. Three properties it is built to keep:
 *
 *  - it does not depend on the room being in a particular stage, which is why the
 *    five dots appear and disappear from axe's `incomplete` list between runs;
 *  - it refuses rather than passing when it cannot resolve something. A condition
 *    that is not `isActive` / `isPast`, a missing size class, a non-literal colour
 *    or an animate object that is not unique all fail loudly instead of quietly
 *    checking nothing — a table that silently stops matching its subject is the
 *    failure mode that let 4.34 ship written as 4.5;
 *  - the ratio it computes has to appear in this file as `<n.nnn>:1`. Re-colour
 *    the dot without re-measuring and the claimed number no longer matches the
 *    computed one, so the comment goes red with the defect.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";

const FILE = "src/components/interview/FlowMap.tsx";
const SRC = readFileSync(path.resolve(process.cwd(), FILE), "utf8");
const SF = ts.createSourceFile(FILE, SRC, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);

const all: ts.Node[] = (() => {
  const out: ts.Node[] = [];
  const walk = (n: ts.Node) => {
    out.push(n);
    n.forEachChild(walk);
  };
  walk(SF);
  return out;
})();

// WCAG contrast spelled out here rather than imported, so a wrong dependency
// cannot make every a11y number in the repo wrong at once.
const channel = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const luminance = (hex: string) => {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return 0.2126 * channel(r / 255) + 0.7152 * channel(g / 255) + 0.0722 * channel(b / 255);
};
const ratio = (a: string, b: string) => {
  const l1 = luminance(a);
  const l2 = luminance(b);
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
};

const assigned = (obj: ts.ObjectLiteralExpression, name: string): ts.PropertyAssignment | undefined =>
  obj.properties.find((p): p is ts.PropertyAssignment => ts.isPropertyAssignment(p) && p.name.getText() === name);

type Resolution = { fg: string; bg: string } | { cannot: string };
const isFailure = (r: Resolution): r is { cannot: string } => "cannot" in r;

/**
 * Resolve one `animate` expression to a literal hex for one state, or say why it
 * could not. Nothing defaults: an expression this cannot evaluate is a failing
 * assertion, never an unchecked one.
 */
function resolve(expr: ts.Expression, state: { isActive: boolean; isPast: boolean }): string | { cannot: string } {
  if (ts.isStringLiteral(expr)) return expr.text;
  if (ts.isParenthesizedExpression(expr)) return resolve(expr.expression, state);
  if (ts.isConditionalExpression(expr)) {
    const c = expr.condition.getText().replace(/\s+/g, " ");
    const chosen =
      c === "isActive"
        ? state.isActive
          ? expr.whenTrue
          : expr.whenFalse
        : c === "isPast"
          ? state.isPast
            ? expr.whenTrue
            : expr.whenFalse
          : c === "isActive || isPast"
            ? state.isActive || state.isPast
              ? expr.whenTrue
              : expr.whenFalse
            : undefined;
    if (chosen === undefined) {
      return { cannot: `condition "${c}" is not a dot state this test knows how to evaluate` };
    }
    return resolve(chosen, state);
  }
  return { cannot: `"${expr.getText()}" is not a literal colour` };
}

function pairFor(obj: ts.ObjectLiteralExpression, state: { isActive: boolean; isPast: boolean }): Resolution {
  const bgProp = assigned(obj, "backgroundColor");
  const fgProp = assigned(obj, "color");
  if (!bgProp) return { cannot: "animate has no backgroundColor assignment" };
  if (!fgProp) return { cannot: "animate has no color assignment" };
  const bg = resolve(bgProp.initializer, state);
  if (typeof bg !== "string") return bg;
  const fg = resolve(fgProp.initializer, state);
  if (typeof fg !== "string") return fg;
  return { fg, bg };
}

const STATES = [
  { name: "active", isActive: true, isPast: false },
  { name: "past", isActive: false, isPast: true },
  { name: "idle", isActive: false, isPast: false },
] as const;

/**
 * The dot's animate object: the only object literal in this file that assigns
 * both `backgroundColor` and `color` and sits in a JSX `animate` attribute.
 * In JSX the braces around an attribute value are a JsxExpression, so the walk
 * up is ObjectLiteral -> JsxExpression -> JsxAttribute -> JsxAttributes.
 */
function findDotAnimate(): ts.ObjectLiteralExpression[] {
  return all.filter((n): n is ts.ObjectLiteralExpression => {
    if (!ts.isObjectLiteralExpression(n)) return false;
    if (!assigned(n, "backgroundColor") || !assigned(n, "color")) return false;
    const attr = n.parent?.parent;
    return attr !== undefined && ts.isJsxAttribute(attr) && attr.name.getText() === "animate";
  });
}

describe("the FlowMap step dot is legible in every state it can render", () => {
  const hits = findDotAnimate();
  // Every case below needs the dot. An early `return` when it is missing would
  // turn all three into passes, which is the exact blindness this guard exists
  // to remove — so the count is asserted, not assumed.
  const dot = () => {
    expect(
      hits.length,
      `expected one JSX animate object assigning both backgroundColor and color, found ${hits.length}`
    ).toBe(1);
    return hits[0];
  };

  it("exactly one animate object carries the dot's fill and text", () => {
    // Two means the second is unattributed and its colours unchecked; zero means
    // the guard went blind, which is how a 4.34:1 dot shipped claiming 4.5:1.
    dot();
  });

  it("every state resolves to a literal foreground/background pair", () => {
    for (const s of STATES) {
      const r = pairFor(dot(), s);
      expect(r, `state "${s.name}"`).not.toHaveProperty("cannot");
    }
  });

  it("each pair meets the AA ratio for the size the dot declares", () => {
    const obj = dot();
    // The threshold belongs to the element, not to this test.
    const attr = obj.parent!.parent as ts.JsxAttribute;
    const opening = attr.parent.parent as ts.JsxOpeningElement | ts.JsxSelfClosingElement;
    const classAttr = opening.attributes.properties.find(
      (p): p is ts.JsxAttribute => ts.isJsxAttribute(p) && p.name.getText() === "className"
    );
    expect(classAttr, "the dot has no className, so its font size is unknown").toBeDefined();
    const classText = classAttr!.initializer?.getText() ?? "";
    const size = classText.match(/text-\[(\d+(?:\.\d+)?)px\]/);
    expect(size, `no text-[Npx] size class in ${classText.slice(0, 140)}`).toBeDefined();
    const px = Number(size![1]);
    const bold = /font-(bold|extrabold|black)/.test(classText);
    // WCAG large text is 24px, or 18.66px at bold-or-heavier; anything else needs 4.5.
    const need = px >= 24 || (px >= 18.66 && bold) ? 3.0 : 4.5;

    for (const s of STATES) {
      const r = pairFor(obj, s);
      if (isFailure(r)) continue;
      const got = ratio(r.fg, r.bg);
      expect(
        Number(got.toFixed(2)),
        `state "${s.name}": ${r.fg} on ${r.bg} at ${px}px/${bold ? "bold" : "normal"} is ${got.toFixed(2)}:1, needs ${need}:1`
      ).toBeGreaterThanOrEqual(need);
    }
  });

  it("the ratios written into the component are the ones being computed", () => {
    const obj = dot();
    const claims: string[] = [];
    for (const s of STATES) {
      const r = pairFor(obj, s);
      if (isFailure(r)) continue;
      const text = `${ratio(r.fg, r.bg).toFixed(2)}:1`;
      if (!claims.includes(text)) claims.push(text);
    }
    expect(claims.length, "the dot's states collapsed to no distinct colour pairs").toBeGreaterThan(0);
    for (const claim of claims) {
      expect(
        SRC.includes(claim),
        `the component states its own contrast; ${claim} is what these colours actually measure and it is missing from ${FILE}`
      ).toBe(true);
    }
  });
});
