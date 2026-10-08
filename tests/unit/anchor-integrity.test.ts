/**
 * Links that go nowhere.
 *
 * `href="#"` is not a placeholder that degrades gracefully — it jumps the
 * viewport to the top and leaves the URL untouched, so a footer entry labelled
 * 帮助中心 behaves like a broken button. The same class with a prettier spelling
 * is `href="#pricing"` on a route that has no pricing section: it looks wired,
 * passes a text scan, and scrolls to nothing.
 *
 * The first two are checked from the parse tree. Bare anchors are measured across all of
 * src; in-page anchors are checked per route page, where the whole rendered
 * document is in one file and the id set is therefore knowable. Components
 * composed by a page are out of scope for the second rule — an anchor in
 * HomeNav legitimately resolves against a section rendered by page.tsx.
 *
 * A third rule closes the remaining hole: an internal target that names no
 * route at all. `href="#"` announces itself; `/dashbaord` renders, clicks, and
 * 404s. See the Rule 3 block at the bottom of this file.
 */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
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

/* ── Rule 3: an internal target must name a route that exists ───────────────
 * `href="/dashbaord"` is invisible to a text scan and to axe: the anchor
 * renders, the click works, and the user lands on a 404. Nothing else in the
 * suite knew the app's route list, which is why the launcher links added in
 * PR #53 (`/setup`, `/dashboard`) had no owner for their spelling.
 *
 * The route set is derived from every `page.tsx` under `src/app`, so deleting a
 * page and leaving links to it is red. Dynamic segments match any single value, and
 * files under `public/` count as targets too. `router.push` / `replace` /
 * `prefetch` / `location.assign` are checked alongside `href`, because they
 * fail the same way.
 */
function appEntries(rel: string): string[] {
  try {
    return readdirSync(new URL(`../../src/app/${rel}`, import.meta.url), { withFileTypes: true })
      .filter((e) => e.isDirectory())
      .map((e) => e.name);
  } catch {
    return [];
  }
}

function appFiles(rel: string): string[] {
  try {
    return readdirSync(new URL(`../../src/app/${rel}`, import.meta.url));
  } catch {
    return [];
  }
}

const PAGE_ROUTES = new Set<string>();
(function collectRoutes(rel: string, prefix: string): void {
  for (const dir of appEntries(rel)) {
    const childRel = rel ? `${rel}/${dir}` : dir;
    // A route group ((marketing)) contributes no path segment.
    const childPrefix = dir.startsWith("(") ? prefix : `${prefix}/${dir}`;
    const files = appFiles(childRel);
    if (files.includes("page.tsx") || files.includes("page.ts")) PAGE_ROUTES.add(childPrefix || "/");
    collectRoutes(childRel, childPrefix);
  }
})("", "");
if (appFiles("").includes("page.tsx")) PAGE_ROUTES.add("/");

function resolves(target: string): boolean {
  const clean = (target.split(/[?#]/)[0] ?? "").replace(/\/+$/, "") || "/";
  const segs = clean.split("/").filter(Boolean);
  for (const route of PAGE_ROUTES) {
    const rs = route.split("/").filter(Boolean);
    if (rs.length !== segs.length) continue;
    if (rs.every((s, i) => s.startsWith("[") || s === segs[i])) return true;
  }
  return existsSync(new URL(`../../public/${clean.replace(/^\//, "")}`, import.meta.url));
}

interface Target {
  file: string;
  line: number;
  href: string;
}

const NAV_CALLS = /\.(push|replace|prefetch|assign)$/;

function internalTargets(file: string): Target[] {
  const src = readFileSync(new URL(`../../${file}`, import.meta.url), "utf8");
  const sf = ts.createSourceFile(file, src, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const out: Target[] = [];
  const visit = (node: ts.Node): void => {
    if (ts.isJsxAttribute(node) && node.name.getText(sf) === "href") {
      const init = node.initializer;
      const lit =
        init && ts.isStringLiteral(init)
          ? init
          : init && ts.isJsxExpression(init) && init.expression && ts.isStringLiteralLike(init.expression)
            ? init.expression
            : null;
      if (lit && lit.text.startsWith("/") && !lit.text.startsWith("//")) {
        out.push({ file, line: sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1, href: lit.text });
      }
    }
    if (ts.isCallExpression(node) && NAV_CALLS.test(node.expression.getText(sf))) {
      const first = node.arguments[0];
      if (first && ts.isStringLiteralLike(first) && first.text.startsWith("/") && !first.text.startsWith("//")) {
        out.push({ file, line: sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1, href: first.text });
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return out;
}

const ALL_TARGETS = ALL_TSX.flatMap(internalTargets);

describe("internal targets name a route that exists", () => {
  it("every literal href / router target resolves to a page or a public asset", () => {
    const offenders = ALL_TARGETS.filter((t) => !t.href.startsWith("/_next") && !resolves(t.href)).map(
      (t) => `${t.file}:${t.line} -> ${t.href}`
    );
    expect(offenders).toEqual([]);
  });

  it("knows the routes it is guarding", () => {
    // Without these the first test could pass on an empty route set, which is
    // exactly how a resolver-based guard goes quietly blind.
    expect(PAGE_ROUTES.size).toBeGreaterThan(10);
    for (const route of ["/", "/setup", "/dashboard/settings", "/dashboard/report/[id]"]) {
      expect(PAGE_ROUTES.has(route), route).toBe(true);
    }
  });

  it("sees targets, and its resolver discriminates", () => {
    expect(ALL_TARGETS.length).toBeGreaterThanOrEqual(40);
    expect(ALL_TARGETS.some((t) => t.href === "/setup")).toBe(true);
    // dynamic segment matches one value; a missing route and an API endpoint do not
    expect(resolves("/dashboard/report/42")).toBe(true);
    expect(resolves("/dashboard/reports")).toBe(false);
    expect(resolves("/api/session")).toBe(false);
    expect(resolves("/definitely-not-a-route")).toBe(false);
  });
});
