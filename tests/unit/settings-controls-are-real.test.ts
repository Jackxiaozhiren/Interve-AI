/**
 * Nothing on the settings page may pretend to be a control.
 *
 * `/dashboard/settings` was a mock: a profile card prefilled with an invented
 * person ("Alex Chen", alex.chen@example.com, a five-year React bio) and a
 * `Save Profile` button with no handler; two notification toggles that were bare
 * `defaultChecked` checkboxes with no store, on an app with no mailer and no SMS
 * provider; a `Update Password` button over two password inputs on an app that
 * stores no credential (`demo-auth: unverified-mint` in docs/SECURITY.md); and a
 * `Sign Out All` that promised to reach devices the session model cannot see.
 * The file's own header comment claimed "no decorative toggles".
 *
 * These predicates make that shape impossible to reintroduce, in either
 * direction: a control without a wiring path is red, and so is the honest copy
 * that replaced it being deleted to dodge the check.
 */
import { readFileSync } from "node:fs";
import ts from "typescript";
import { describe, expect, it } from "vitest";

const PAGE = "src/app/dashboard/settings/page.tsx";
const src = readFileSync(new URL(`../../${PAGE}`, import.meta.url), "utf8");
const sf = ts.createSourceFile(PAGE, src, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);

const CONTROL_TAGS = /^(Button|InterveButton|button)$/;
const HANDLERS = new Set(["onClick", "onSubmit", "onChange", "onMouseDown", "onPointerDown"]);
const ESCAPES = new Set(["disabled", "href", "type", "form", "asChild", "as"]);

interface NodeInfo {
  tag: string;
  attrs: Map<string, string | null>;
  hasSpread: boolean;
}

function infoOf(node: ts.JsxOpeningElement | ts.JsxSelfClosingElement): NodeInfo {
  const attrs = new Map<string, string | null>();
  let hasSpread = false;
  for (const prop of node.attributes.properties) {
    if (ts.isJsxAttribute(prop)) {
      attrs.set(prop.name.getText(sf), prop.initializer ? prop.initializer.getText(sf) : null);
    } else {
      hasSpread = true;
    }
  }
  return { tag: node.tagName.getText(sf), attrs, hasSpread };
}

/**
 * `onClick={() => undefined}` satisfies "has a handler" and still does nothing,
 * which is the whole defect with a prop bolted on. A presence check alone lets it
 * pass — this file's own falsification battery planted exactly that shape and
 * watched the wiring case stay green, so the body has to be read too.
 */
function isNoopHandler(text: string | null): boolean {
  if (text === null) return true;
  // The initializer text of a JSX attribute keeps its braces: `onClick={…}` is
  // stored as `{() => undefined}`, so unwrap before judging the body.
  let t = text.replace(/\s+/g, " ").trim();
  if (t.startsWith("{") && t.endsWith("}")) t = t.slice(1, -1).trim();
  return (
    /^(?:async\s+)?\(\s*\)\s*=>\s*undefined$/.test(t) ||
    /^(?:async\s+)?\(\s*\)\s*=>\s*\{\s*\}$/.test(t) ||
    /^(?:async\s+)?function\s*\(\s*\)\s*\{\s*\}$/.test(t)
  );
}

/** Every actionable control in the file, with whether anything wires it. */
const controls: { tag: string; line: number; wired: boolean; why: string }[] = [];
(function walk(node: ts.Node): void {
  if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
    const info = infoOf(node);
    if (CONTROL_TAGS.test(info.tag)) {
      const own = [...info.attrs.entries()].some(([k, v]) => HANDLERS.has(k) && !isNoopHandler(v));
      const escaped = [...info.attrs.keys()].some((k) => ESCAPES.has(k)) || info.hasSpread;
      // A wrapping <form onSubmit> or <label htmlFor> also wires a control.
      let ancestorWired = false;
      for (let a = node.parent; a && !ancestorWired; a = a.parent) {
        if (ts.isJsxElement(a)) {
          const outer = infoOf(a.openingElement);
          if (outer.tag === "form" && outer.attrs.has("onSubmit")) ancestorWired = true;
          if (outer.tag === "Link" || outer.tag === "a") ancestorWired = true;
        }
      }
      controls.push({
        tag: info.tag,
        line: sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1,
        wired: own || escaped || ancestorWired,
        why: `${info.tag} at ${PAGE}:${sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1}`,
      });
    }
  }
  ts.forEachChild(node, walk);
})(sf);

/** Inputs with a literal `defaultValue` — invented data shown as the user's own. */
const literalDefaults: string[] = [];
(function walkAttrs(node: ts.Node): void {
  if (ts.isJsxAttribute(node) && node.name.getText(sf) === "defaultValue" && node.initializer) {
    literalDefaults.push(node.initializer.getText(sf));
  }
  if (ts.isJsxAttribute(node) && node.name.getText(sf) === "defaultChecked") {
    literalDefaults.push("defaultChecked");
  }
  ts.forEachChild(node, walkAttrs);
})(sf);

describe(`the controls on ${PAGE} do something`, () => {
  it("finds the controls it claims to inspect (instrument sanity)", () => {
    // The accessibility and language toggles are real and many; a walker that
    // matched nothing would pass every predicate below by construction.
    // Four today: the two notification-style rows became prose, and the three
    // dead buttons became one wired sign-out, so the population is smaller than
    // the file it replaced. Any floor here exists to catch a walker that matched
    // nothing, not to pin a count — that is the next case's job.
    expect(controls.length, "no controls found — the probe is blind").toBeGreaterThanOrEqual(3);
    expect(controls.filter((c) => c.wired).length).toBe(controls.length);
    // And the sign-out control must still exist: deleting every button would make
    // both assertions above vacuous.
    expect(src).toMatch(/onClick=\{\(\) => void logout\(\)\}/);
  });

  it("has no button without a handler, a form, a link, or a disabled state", () => {
    expect(controls.filter((c) => !c.wired).map((c) => c.why)).toEqual([]);
  });

  it("prefills nothing with invented data", () => {
    expect(literalDefaults, `prefilled values are not the user's: ${literalDefaults.join(", ")}`).toEqual([]);
  });

  it("keeps the reason visible rather than deleting the honest sentence", () => {
    // The alternative to a working control is saying it cannot work yet. If the
    // copy is deleted the checks above go green while the user learns nothing, so
    // the disclosure itself is pinned.
    expect(src).toContain("no email sender and no SMS provider");
    expect(src).toContain("sign-in is a demo session, not a credential");
    expect(src).toContain("Other browsers keep theirs");
    // And the identity fields must come from the session, not from a literal.
    expect(src).toMatch(/value=\{user\?\.email/);
    expect(src).toMatch(/value=\{user\?\.username/);
  });
});
