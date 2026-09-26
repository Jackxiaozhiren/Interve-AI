// V11 round-1 finding: 19 pages, one error boundary (src/app/error.tsx), zero
// global-error.tsx. error.tsx does NOT wrap the root layout or template, so a
// throw there fell through to Next's built-in 500 — no recovery action, no
// reference code, nothing the owner could act on.
//
// Two traps here fail silently, which is why this is pinned rather than left to
// a crash no test run produces:
//   1. global-error replaces the root layout, so it must emit its own
//      <html>/<body> — Next's server stream injects a placeholder document when
//      they are missing (node-web-streams-helper.js, "Missing <html> and <body>
//      tags in the root layout").
//   2. Next renders it WITHOUT globals.css, so Tailwind classes are dead markup
//      (16.3.6 docs; Next's own builtin/global-error.js ships an inline <style>
//      for the same reason). The class check below therefore reads the rendered
//      document, not the source.
import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import GlobalError from "@/app/global-error";

const FILE = "src/app/global-error.tsx";
const PATH = new URL(`../../${FILE}`, import.meta.url);

function render(error: Error & { digest?: string }): string {
  return renderToStaticMarkup(createElement(GlobalError, { error }));
}

const serverError = () =>
  Object.assign(new Error("layout blew up"), { digest: "a1b2c3d4e5f6" });
const clientError = () => new Error("chunk failed");

/** Classes the rendered markup applies. */
function classesIn(html: string): string[] {
  return [...html.matchAll(/class="([^"]+)"/g)].flatMap((m) => m[1].trim().split(/\s+/));
}

/** Class selectors the rendered document's own stylesheet declares. */
function definedIn(html: string): Set<string> {
  const style = /<style>([\s\S]*?)<\/style>/.exec(html)?.[1] ?? "";
  return new Set([...style.matchAll(/\.([a-zA-Z][\w-]*)/g)].map((m) => m[1]));
}

describe("contract of a root error boundary (source-level)", () => {
  it(`${FILE} exists and is a client component`, () => {
    expect(existsSync(PATH)).toBe(true);
    expect(readFileSync(PATH, "utf8").startsWith('"use client"')).toBe(true);
  });

  // metadata exports are unsupported here (the file is a Client Component), and
  // importing app modules re-enters the graph that just threw.
  it("imports nothing from the failed graph and exports no metadata", () => {
    const text = readFileSync(PATH, "utf8");
    expect(text).not.toMatch(/export const metadata/);
    expect(text).not.toMatch(/from ["']@\//);
  });
});

describe("rendered fallback document", () => {
  it("supplies its own html, body and title", () => {
    const html = render(serverError());
    // renderToStaticMarkup omits the DOCTYPE Next's document stream adds.
    expect(html).toMatch(/^<html lang="zh-CN">/);
    expect(html).toMatch(/<body>/);
    expect(html).toMatch(/<title>Something went wrong · Interve AI<\/title>/);
  });

  it("ships the stylesheet it depends on", () => {
    const html = render(clientError());
    expect(/<style>[\s\S]*color-scheme: light/.test(html), "no inline stylesheet").toBe(true);
  });

  // The regression this catches: `className="text-slate-500"` looks right in the
  // editor and renders as unstyled text, because globals.css never loads here.
  it("applies only classes its own stylesheet defines", () => {
    for (const html of [render(serverError()), render(clientError())]) {
      const defined = definedIn(html);
      const missing = [...new Set(classesIn(html))].filter((c) => !defined.has(c));
      expect(missing, `classes with no rule: ${missing.join(", ")}`).toEqual([]);
    }
  });

  // This page shows when the app's own JS may not have survived, so the primary
  // action must not need an event handler. Next's builtin uses a form submit.
  it("reloads through a native form submit", () => {
    const html = render(clientError());
    expect(html).toMatch(/<form><button type="submit"[^>]*>Reload<\/button><\/form>/);
  });

  it("keeps a focus ring it can apply itself", () => {
    expect(render(clientError())).toMatch(/button:focus-visible/);
  });
});

describe("error-kind branching", () => {
  it("surfaces the digest as a reference for server errors", () => {
    const html = render(serverError());
    expect(html).toContain("a1b2c3d4e5f6");
    expect(html).toContain("Reference:");
  });

  // A server-side throw means the same render fails again on any route, so
  // "Go back" would only strand the user in the broken history entry.
  it("hides 'Go back' for server errors and offers it for client errors", () => {
    expect(render(serverError())).not.toContain("Go back");
    const html = render(clientError());
    expect(html).toContain("Go back");
    expect(html).not.toContain("Reference:");
  });
});
