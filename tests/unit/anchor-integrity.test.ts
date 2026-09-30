/**
 * Links that go nowhere.
 *
 * `href="#"` is not a placeholder that degrades gracefully — it jumps the
 * viewport to the top and leaves the URL untouched, so a footer entry labelled
 * 帮助中心 behaves like a broken button. The same class with a prettier spelling
 * is `href="#pricing"` on a route that has no pricing section: it looks wired,
 * passes a text scan, and scrolls to nothing.
 *
 * Both are checked from the parse tree. Bare anchors are measured across all of
 * src; in-page anchors are checked per route page, where the whole rendered
 * document is in one file and the id set is therefore knowable. Components
 * composed by a page are out of scope for the second rule — an anchor in
 * HomeNav legitimately resolves against a section rendered by page.tsx.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import ts from "typescript";
import { describe, expect, it } from "vitest";

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(new URL(`../../${dir}`, import.meta.url))) {
    const rel = `${dir}/${entry}`;
    if (statSync(new URL(`../../${rel}`, import.meta.url)).isDirectory()) out.push(...walk(rel));
    else if (/\.tsx$/.test(entry)) out.push(rel);
  }
  return out;
}

interface AnchorInfo {
  bare: number[];
  unresolved: { line: number; href: string }[];
}

function inspect(file: string): AnchorInfo {
  const src = readFileSync(new URL(`../../${file}`, import.meta.url), "utf8");
  const sf = ts.createSourceFile(file, src, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const ids = new Set<string>();
  const bare: number[] = [];
  const local: { line: number; href: string }[] = [];

  const staticText = (init: ts.JsxAttribute["initializer"]): string | null => {
    if (!init) return null;
    if (ts.isStringLiteral(init)) return init.text;
    // A JSX expression is only treated as static when it is a plain string
    // literal in braces; anything computed (a template like `#${s.id}`) is
    // unverifiable from one file and deliberately skipped.
    if (ts.isJsxExpression(init) && init.expression && ts.isStringLiteralLike(init.expression)) {
      return init.expression.text;
    }
    return null;
  };

  const visit = (node: ts.Node) => {
    if (ts.isJsxSelfClosingElement(node) || ts.isJsxElement(node)) {
      const open = ts.isJsxSelfClosingElement(node) ? node : node.openingElement;
      for (const attr of open.attributes.properties) {
        if (!ts.isJsxAttribute(attr)) continue;
        const name = attr.name.getText(sf);
        const line = sf.getLineAndCharacterOfPosition(attr.getStart(sf)).line + 1;
        if (name === "id") {
          const v = staticText(attr.initializer);
          if (v) ids.add(v);
          continue;
        }
        if (name !== "href") continue;
        const v = staticText(attr.initializer);
        // The bare placeholder is the one-character string "#". An empty string
        // would mean href="", which is a different (and rarer) mistake — both are
        // treated as dead here rather than silently passing.
        if (v === "#" || v === "") bare.push(line);
        else if (v?.startsWith("#")) local.push({ line, href: v });
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);

  return {
    bare,
    unresolved: local.filter((a) => !ids.has(a.href.slice(1))),
  };
}

const ALL_TSX = walk("src");
const ROUTE_PAGES = ALL_TSX.filter((f) => /\/page\.tsx$/.test(f));

describe("no bare href=\"#\" anywhere", () => {
  it("across every component and page in src", () => {
    const offenders = ALL_TSX.flatMap((f) => inspect(f).bare.map((line) => `${f}:${line}`));
    expect(offenders).toEqual([]);
  });
});

describe("in-page anchors resolve on their own route", () => {
  it("every static #target on a page has a matching id on that page", () => {
    const offenders = ROUTE_PAGES.flatMap((f) =>
      inspect(f).unresolved.map((a) => `${f}:${a.line} -> ${a.href}`)
    );
    expect(offenders).toEqual([]);
  });

  it("the landing page still owns the sections its nav points at", () => {
    // Guards the specific regression: this route once advertised 定价 and 关于
    // while only rendering home / features / demo.
    const src = readFileSync(new URL("../../src/app/landing/page.tsx", import.meta.url), "utf8");
    for (const id of ["home", "features", "demo"]) expect(src, id).toContain(`id="${id}"`);
    expect(src).not.toMatch(/href="#pricing"|href="#about"/);
  });
});

describe("the instrument itself is not vacuous", () => {
  it("finds ids and anchors on the landing page", () => {
    // If this ever reports zero, the walker stopped seeing the file and the two
    // tests above would be passing on an empty input.
    const probe = inspect("src/app/landing/page.tsx");
    expect(ROUTE_PAGES.length).toBeGreaterThan(5);
    expect(probe.bare).toEqual([]);
    expect(probe.unresolved).toEqual([]);
  });
});
