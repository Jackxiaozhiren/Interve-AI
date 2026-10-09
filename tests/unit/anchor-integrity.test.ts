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

/**
 * The same corpus plus `.ts`.
 *
 * Navigation is not confined to JSX: `useInterviewSettlement` assigns
 * `window.location.href` from inside a plain `.ts` hook, and the sidebar's
 * destinations live in an array of objects rather than in `href` attributes. A
 * collector that reads only `.tsx` `href` attributes therefore could not see half
 * of the app's navigations — which is why the reachability rule below uses this.
 */
function walkNavigable(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(new URL(`../../${dir}`, import.meta.url))) {
    const rel = `${dir}/${entry}`;
    if (statSync(new URL(`../../${rel}`, import.meta.url)).isDirectory()) out.push(...walkNavigable(rel));
    else if (/\.(ts|tsx)$/.test(entry)) out.push(rel);
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
  const sf = ts.createSourceFile(
    file,
    src,
    ts.ScriptTarget.Latest,
    true,
    file.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS
  );
  const out: Target[] = [];
  const line = (node: ts.Node) => sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1;

  /**
   * A navigation destination is a static string, a whole template with nothing
   * substituted, or the literal head of a template. The third is the one a text
   * scan and the old collector both missed: 13 of the app's 58 destinations are
   * built as `/dashboard/replay/${session.id}`, so a typo inside one of those
   * prefixes used to be invisible to the guard that exists to catch typos.
   *
   * A head that stops at a segment boundary is given one dummy segment, so
   * `/dashboard/replay/` is resolved as if it addressed a real id rather than
   * being thrown away for wanting a value.
   */
  const push = (node: ts.Node | undefined, rawText: string | null): void => {
    if (!node || rawText === null) return;
    if (!rawText.startsWith("/") || rawText.startsWith("//")) return;
    const href = rawText !== "/" && rawText.endsWith("/") ? `${rawText}1` : rawText;
    out.push({ file, line: line(node), href });
  };

  /**
   * Every destination spelled inside an expression, not just the expression
   * itself: `window.location.href = isReport ? `/dashboard/report/${id}` :
   * "/dashboard"` puts its route inside a conditional, so a reader that only
   * looked at the top node would call that page unreachable while the code right
   * there navigates to it. Object literals and nested functions are not entered —
   * an object's `href:` is its own navigation site, visited from `visit`.
   */
  const pushAll = (site: ts.Node, expr: ts.Expression | ts.JsxAttribute["initializer"] | undefined): void => {
    if (!expr) return;
    const top = ts.isJsxExpression(expr) ? expr.expression : expr;
    if (!top) return;
    const scan = (n: ts.Node): void => {
      if (ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n)) return push(site, n.text);
      if (ts.isTemplateExpression(n)) return push(site, n.head.text);
      if (ts.isFunctionLike(n) || ts.isObjectLiteralExpression(n)) return;
      ts.forEachChild(n, scan);
    };
    scan(top);
  };

  const visit = (node: ts.Node): void => {
    if (ts.isJsxAttribute(node) && node.name.getText(sf) === "href") {
      pushAll(node, node.initializer);
    }
    // `{ name: "Knowledge Base", href: "/dashboard/knowledge" }` — the sidebar's
    // destinations are data, and data navigates.
    if (ts.isPropertyAssignment(node) && node.name.getText(sf) === "href") {
      pushAll(node, node.initializer);
    }
    // `window.location.href = ...` — the deliberate whole-document exit.
    if (
      ts.isBinaryExpression(node) &&
      node.operatorToken.kind === ts.SyntaxKind.EqualsToken &&
      /\.href$/.test(node.left.getText(sf))
    ) {
      pushAll(node, node.right);
    }
    if (ts.isCallExpression(node) && NAV_CALLS.test(node.expression.getText(sf))) {
      pushAll(node, node.arguments[0]);
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return out;
}

const NAV_FILES = walkNavigable("src");
const ALL_TARGETS = NAV_FILES.flatMap(internalTargets);

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
    // 58 measured 2026-10-09, once `.ts` files, `href:` data properties and
    // template heads are included. The floor sits below that so widening the
    // collector cannot be mistaken for the guard going quiet.
    expect(ALL_TARGETS.length).toBeGreaterThanOrEqual(50);
    expect(ALL_TARGETS.some((t) => t.href === "/setup")).toBe(true);
    // dynamic segment matches one value; a missing route and an API endpoint do not
    expect(resolves("/dashboard/report/42")).toBe(true);
    expect(resolves("/dashboard/reports")).toBe(false);
    expect(resolves("/api/session")).toBe(false);
    expect(resolves("/definitely-not-a-route")).toBe(false);
  });
});

/* ── Rule 4: a page nobody navigates to is a page that does not exist ───────
 * Rule 3 asks whether a destination names a route. It cannot answer the
 * opposite question, and the opposite question was worth four routes: on
 * 2026-10-09 nothing in `src/` navigated to `/dashboard/interview`,
 * `/dashboard/knowledge`, `/dashboard/resume` or `/dashboard/report/[id]`
 * while `/dashboard/interview` — a whole launcher page with three cards — sat
 * unreachable, reachable only by typing the URL. Two of those four were the
 * collector's fault (data-driven nav and a `location.href` assignment in a `.ts`
 * hook); the other two were real, and this rule is what made them visible.
 *
 * A route counts as reached when a navigation-shaped destination names it from
 * a file that is not that page's own `page.tsx`: a page linking to itself is not
 * a way in. `resolves()` is deliberately not reused here — it answers "could any
 * route take this string", and this rule needs the specific route it took it to.
 */
const ROUTE_OWN_FILE = new Map<string, string>();
(function ownFiles(rel: string, prefix: string): void {
  for (const dir of appEntries(rel)) {
    const childRel = rel ? `${rel}/${dir}` : dir;
    const childPrefix = dir.startsWith("(") ? prefix : `${prefix}/${dir}`;
    const files = appFiles(childRel);
    if (files.includes("page.tsx") || files.includes("page.ts")) {
      ROUTE_OWN_FILE.set(childPrefix || "/", `src/app/${childRel}/page.tsx`);
    }
    ownFiles(childRel, childPrefix);
  }
})("", "");
if (appFiles("").includes("page.tsx")) ROUTE_OWN_FILE.set("/", "src/app/page.tsx");

function reachedFrom(route: string): string[] {
  const rs = route.split("/").filter(Boolean);
  const hits = new Set<string>();
  for (const t of ALL_TARGETS) {
    if (t.file === ROUTE_OWN_FILE.get(route)) continue;
    const clean = (t.href.split(/[?#]/)[0] ?? "").replace(/\/+$/, "") || "/";
    const segs = clean.split("/").filter(Boolean);
    if (rs.length === segs.length && rs.every((s, i) => s.startsWith("[") || s === segs[i])) hits.add(t.file);
  }
  return [...hits].sort();
}

/**
 * Routes that are reachable by URL and by design, and nothing more. May only
 * shrink. Each entry must say why, in terms a reader can check.
 */
const UNLINKED: Record<string, string> = {
  "/recruiter":
    "kept as the labelled recruiter demo (docs/audit decision 2026-10-08, PR #15): it is a " +
    "showcase surface, so the candidate product deliberately has no link into it. Its own page " +
    "links to /recruiter/assessments, which this rule confirms is reached.",
};

const deadRoutes = [...ROUTE_OWN_FILE.keys()].filter((r) => r !== "/" && reachedFrom(r).length === 0);

describe("every page route can be navigated to", () => {
  it("no route is orphaned beyond the declared list", () => {
    expect(deadRoutes.sort(), `unreachable: ${deadRoutes.join(", ")}`).toEqual(
      Object.keys(UNLINKED).sort()
    );
  });

  it("is not passing because the corpus is empty", () => {
    // 21 routes measured 2026-10-09. Without this the rule above could be green
    // on a route set of zero, which is the standard way a guard becomes ornament.
    expect(ROUTE_OWN_FILE.size).toBeGreaterThanOrEqual(20);
    expect(reachedFrom("/setup").length, "/setup is the wizard every launcher links to").toBeGreaterThan(3);
    expect(reachedFrom("/dashboard/settings")).not.toEqual([]);
    // a dynamic route reached only through a template head
    expect(reachedFrom("/dashboard/report/[id]"), "window.location.href in useInterviewSettlement").not.toEqual([]);
  });

  it("declares only routes that really are unlinked, and says why", () => {
    for (const [route, why] of Object.entries(UNLINKED)) {
      expect(ROUTE_OWN_FILE.has(route), `${route} is declared but has no page`).toBe(true);
      expect(reachedFrom(route), `${route} is declared unlinked but something navigates to it`).toEqual([]);
      expect(why.length).toBeGreaterThan(40);
    }
  });
});
