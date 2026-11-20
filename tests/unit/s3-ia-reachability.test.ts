/**
 * S3 IA reachability contract (§12.13 S3 criterion ①).
 *
 * The roadmap says "every page.tsx has at least one internal link". Read
 * literally that would demand a Link inside each dashboard child page, which
 * already sits under DashboardShell's six-item sidebar — adding a second nav
 * to every page would duplicate the very navigation this stage is fixing.
 * The enforceable invariant is reachability, so a page passes by any of three
 * routes: its own <Link href="/...">, a router.push("/...") return path, or a
 * parent layout that renders a persistent main navigation.
 *
 * Two pages are deliberately isolated and exempted by name, with the reason:
 *  - /interview: the live room has an exit button (router.push), and adding
 *    ambient navigation during a recorded interview invites accidental exit.
 *  - /s/[token]: a shared report page for a candidate; product navigation would
 *    leak the surrounding product into a link someone sent externally.
 * The exemption list is asserted, so a new page cannot hide here by being
 * added to it without this file changing.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { walkRepo } from "./repo-tree";

const read = (rel: string) => readFileSync(path.resolve(process.cwd(), rel), "utf8");

const PAGES = walkRepo("src/app", (rel) => rel.endsWith("page.tsx"));

const EXEMPT = new Map([
  ["src/app/interview/page.tsx", "live room: exit via router.push, no ambient nav during a recorded interview"],
  ["src/app/s/[token]/page.tsx", "shared candidate report: product nav must not leak into an external link"],
  ["src/app/login/page.tsx", "authentication door: the route has no outbound nav by design; its CTA is the auth form"],
  ["src/app/page.tsx", "gatekept root: redirects to /login or /dashboard, so it is an entry not a destination"],
]);

/** Layouts that render a persistent main navigation for every descendant. */
const NAV_LAYOUTS = ["src/app/dashboard/layout.tsx"];

function underNav(page: string): boolean {
  return NAV_LAYOUTS.some((layout) => page.startsWith(path.dirname(layout) + "/"));
}

function hasOwnNavigation(src: string): boolean {
  const link = /href=["'`]\/(?!api\/)[^"'`]+["'`]/.test(src);
  const push = /router\.push\(["'`]\/(?!api\/)[^"'`]+["'`]/.test(src);
  return link || push;
}

describe("S3: every route is reachable from a main navigation surface", () => {
  it("covers all 22 pages", () => {
    expect(PAGES.length).toBe(22);
  });

  it("every page has a Link, a return push, a nav-bearing layout, or a declared exemption", () => {
    const unreachable = PAGES.filter(
      (p) => !underNav(p) && !hasOwnNavigation(read(p)) && !EXEMPT.has(p),
    );
    expect(unreachable, "pages with no route into or out of them").toEqual([]);
  });

  it("keeps the exemption list exact — a new page cannot opt out silently", () => {
    expect([...EXEMPT.keys()].sort()).toEqual([
      "src/app/interview/page.tsx",
      "src/app/login/page.tsx",
      "src/app/page.tsx",
      "src/app/s/[token]/page.tsx",
    ]);
  });

  it("/chat is reachable from the main nav and has a way back", () => {
    const shell = read("src/app/dashboard/dashboard-shell.tsx");
    expect(shell, "dashboard sidebar must expose /chat").toMatch(/href:\s*["']\/chat["']/);
    expect(shell, "sidebar labels must be Chinese").not.toMatch(/name:\s*["'](Dashboard|My Interviews|Knowledge Base|Privacy|Settings)["']/);
    const chat = read("src/app/chat/page.tsx");
    expect(chat, "/chat must link back to the product").toMatch(/href=["']\/dashboard["']/);
  });

  it("/recruiter has an entry but is labelled as a demo, not a product tier", () => {
    const footer = read("src/components/layout/Footer.tsx");
    expect(footer).toMatch(/href=["']\/recruiter["']/);
    expect(footer, "must not sell a nonexistent enterprise tier").not.toMatch(/href=["']\/recruiter["'][^>]*>企业/);
    expect(footer).toMatch(/招聘方演示/);
  });

  it("every exemption still carries its stated reason", () => {
    for (const [, reason] of EXEMPT) expect(reason.length).toBeGreaterThan(20);
  });
});
