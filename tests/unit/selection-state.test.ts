/**
 * A toggle that does not say which state it is in is invisible.
 *
 * Measured before the fix: 14 buttons under src/ repaint themselves when chosen
 * — border, shadow, icon weight, or an animated active background — and 10 of
 * them said nothing to assistive technology. Eight of those 10 are the setup
 * wizard's own cards (role, level, company, persona, framework, model, stress,
 * coding), and the other two are the chat model picker, in both of its modes.
 * The axe lane never flagged this: no rule requires a pressed state, so the page
 * audited green while a screen-reader user heard "Frontend Engineer, button" and
 * could not tell whether that was the role about to be interviewed.
 *
 * Two predicates over the tsx files under src/, on the parse tree:
 *   1. a `button` whose `className` picks a class from a condition *named* like
 *      a selection (`isSelected`, `selectedRole === …`);
 *   2. a `button` whose subtree animates an active highlight with a `layoutId` —
 *      the app's card idiom, and the only signal for cards whose boolean is
 *      named `stressTest` or `includeCoding`, which predicate 1 cannot see.
 * Either way the button must expose the state through `aria-pressed`,
 * `aria-checked`, `aria-selected` or a `role` that carries it.
 */
import fs from "node:fs";
import path from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";

const STATE_ATTRS = new Set(["aria-pressed", "aria-checked", "aria-selected", "role"]);
const SELECTION_COND = /\bisSelected\b|\bselected[A-Z]\w*|\bchosen[A-Z]\w*|===\s*selected/i;

function findTsx(dir = path.join(process.cwd(), "src")): string[] {
  const out: string[] = [];
  const walk = (d: string) => {
    for (const entry of fs.readdirSync(d, { withFileTypes: true })) {
      const full = path.join(d, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name.endsWith(".tsx")) out.push(full);
    }
  };
  walk(dir);
  return out;
}

/** Predicate 1: the className picks a class from a condition named like a selection. */
function isSelectionDriven(source: ts.SourceFile, initializer: ts.Node | undefined): boolean {
  if (!initializer) return false;
  let hit = false;
  const visit = (node: ts.Node) => {
    if (ts.isConditionalExpression(node) && SELECTION_COND.test(node.condition.getText(source))) hit = true;
    node.forEachChild(visit);
  };
  visit(initializer);
  return hit;
}

/**
 * Predicate 2: the button carries a layoutId marker, i.e. it animates its own
 * "currently active" background. Name-agnostic on purpose — without it the
 * guard sees 8 of the 10 real cards and would report green over two silent ones.
 */
function hasActiveLayoutMarker(source: ts.SourceFile, children: readonly ts.Node[]): boolean {
  let hit = false;
  const visit = (node: ts.Node) => {
    if (ts.isJsxAttribute(node) && node.name.getText(source) === "layoutId") hit = true;
    node.forEachChild(visit);
  };
  children.forEach(visit);
  return hit;
}

function scanSource(label: string, text: string): { silent: string[]; exposed: number } {
  const source = ts.createSourceFile(label, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const silent: string[] = [];
  let exposed = 0;

  const check = (tagNode: ts.JsxOpeningElement | ts.JsxSelfClosingElement, children: readonly ts.Node[]) => {
    if (tagNode.tagName.getText(source) !== "button") return;
    const attrs = tagNode.attributes.properties.filter(ts.isJsxAttribute);
    const classAttr = attrs.find((a) => a.name.getText(source) === "className");
    if (!(isSelectionDriven(source, classAttr?.initializer) || hasActiveLayoutMarker(source, children))) return;
    const line = source.getLineAndCharacterOfPosition(tagNode.getStart(source)).line + 1;
    if (attrs.some((a) => STATE_ATTRS.has(a.name.getText(source)))) exposed += 1;
    else silent.push(`${label}:${line}`);
  };

  // A JsxOpeningElement node carries only attributes; the card subtree lives on
  // its parent JsxElement, so the children have to come from there.
  const visit = (node: ts.Node) => {
    if (ts.isJsxElement(node)) check(node.openingElement, node.children);
    else if (ts.isJsxSelfClosingElement(node)) check(node, []);
    node.forEachChild(visit);
  };
  visit(source);
  return { silent, exposed };
}

describe("the probe itself (it must be able to fail, and must not fire on a class name)", () => {
  const cases: [string, string, number][] = [
    ["aria-pressed on the same button", '<button className={`x ${isSelected ? "on" : "off"}`} aria-pressed={isSelected} />', 0],
    ["no state attribute at all", '<button className={`x ${isSelected ? "on" : "off"}`} />', 1],
    ["role that carries the state", '<button role="radio" className={`x ${isSelected ? "on" : "off"}`} />', 0],
    ["condition compares a selected id", '<button className={`x ${selectedRole === role.id ? "on" : "off"}`} />', 1],
    ["a class literally named is-selected", '<button className="btn is-selected" />', 0],
    ["an unrelated button", '<button className="rounded-full" onClick={go} />', 0],
    ["a div styled by selection is not a button", '<div className={`x ${isSelected ? "on" : "off"}`} />', 0],
    ["active-layout card with no state", '<button className="p-6">{on && <motion.div layoutId="x-active" />}</button>', 1],
    ["the same card, disclosed", '<button aria-pressed={on} className="p-6">{on && <motion.div layoutId="x-active" />}</button>', 0],
    ["a layout marker outside any button", '<div>{on && <motion.div layoutId="panel-active" />}</div>', 0],
    ["a plain button beside a highlighted one", '<div><button>Other</button><button>{on && <motion.div layoutId="c" />}</button></div>', 1],
  ];
  it.each(cases)("reports %s", (_label, body, expected) => {
    expect(scanSource("probe.tsx", body).silent).toHaveLength(expected);
  });

  it("names the silent toggle it finds, with its line", () => {
    const { silent } = scanSource("probe.tsx", '<button className={`p-6 ${isSelected ? "on" : "off"}`} />');
    expect(silent).toEqual(["probe.tsx:1"]);
  });

  it("counts an exposed toggle rather than reporting it", () => {
    const { exposed } = scanSource("probe.tsx", '<button className={`p-6 ${isSelected ? "on" : "off"}`} aria-pressed={isSelected} />');
    expect(exposed).toBe(1);
  });

  it("reports a card matching both predicates once", () => {
    const body = '<button className={`p-6 ${isSelected ? "on" : "off"}`}>{isSelected && <motion.div layoutId="c" />}</button>';
    expect(scanSource("probe.tsx", body).silent).toEqual(["probe.tsx:1"]);
  });
});

describe("src/ selection buttons expose the state they paint", () => {
  const reports = findTsx().map((file) => {
    const label = path.relative(process.cwd(), file);
    return { label, ...scanSource(label, fs.readFileSync(file, "utf8")) };
  });
  const silent = reports.flatMap((r) => r.silent);

  it("sees the toggles this guard exists to protect, so it cannot pass by seeing nothing", () => {
    // 14 = the count measured after every site was disclosed. Deleting a card
    // silently is a product change, so it has to make this fail.
    expect(reports.reduce((sum, r) => sum + r.exposed, 0)).toBeGreaterThanOrEqual(14);
  });

  it("lists no button that changes its own paint on selection without saying so", () => {
    expect(silent).toEqual([]);
  });
});
