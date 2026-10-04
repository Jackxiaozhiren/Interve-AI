/**
 * The enforced CSP, and the one sentence of the privacy page that describes it.
 *
 * Two mistakes this exists to prevent, both made in this repo this week:
 *
 * 1. The privacy page told candidates their browser loads fonts from
 *    fonts.googleapis.com and fonts.gstatic.com "so those parties see your IP".
 *    It never does: there is no `next/font` import, no `<link>` in any layout,
 *    no `@import url(...)` in globals.css and no bundled font file. A privacy
 *    policy that names a third party the app never contacts is a false
 *    disclosure about processing, not a harmless over-listing.
 * 2. Removing `cdn.jsdelivr.net` from `script-src` because the hostname appears
 *    nowhere in `src/`. It is live: `@monaco-editor/loader` defaults its `vs`
 *    path to `https://cdn.jsdelivr.net/npm/monaco-editor@0.55.1/min/vs` and the
 *    scratchpad never calls `loader.config()`. Grepping only first-party source
 *    proves nothing about a runtime fetch.
 *
 * So the invariant is bidirectional and keyed on evidence that is re-derived on
 * every run, not on a comment someone can edit out.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";

const read = (rel: string) => readFileSync(new URL(`../../${rel}`, import.meta.url), "utf8");

const proxy = read("src/proxy.ts");
const privacy = read("src/app/privacy/page.tsx");

/** The enforced policy's directive map, parsed out of the template literal. */
const directives = (() => {
  const start = proxy.indexOf("const cspHeader = `");
  expect(start, "cspHeader template literal not found").toBeGreaterThan(-1);
  const body = proxy.slice(start, proxy.indexOf("`", start + 22));
  const out = new Map<string, string>();
  for (const clause of body.replace(/\s+/g, " ").split(";")) {
    const trimmed = clause.trim();
    if (!trimmed) continue;
    const [name, ...rest] = trimmed.split(" ");
    out.set(name, rest.join(" "));
  }
  return out;
})();

/**
 * Every external host the policy allows, mapped to the pattern that must appear
 * in the privacy page's third-party sentence. Adding a host to the CSP without
 * deciding how to disclose it fails here; so does leaving a mapping whose host
 * has gone away.
 */
const HOST_DISCLOSURE: Record<string, RegExp> = {
  "cdn.jsdelivr.net": /jsDelivr/,
};

const externalHosts = (value: string) =>
  [...value.matchAll(/https:\/\/([a-z0-9.-]+)/gi)].map((m) => m[1].toLowerCase());

function walkSource(dir: string, visit: (abs: string, text: string) => void): void {
  for (const entry of readdirSync(new URL(`../../${dir}`, import.meta.url))) {
    const rel = `${dir}/${entry}`;
    const abs = new URL(`../../${rel}`, import.meta.url);
    if (statSync(abs).isDirectory()) walkSource(rel, visit);
    else if (/\.(ts|tsx)$/.test(entry)) visit(path.normalize(rel), readFileSync(abs, "utf8"));
  }
}

describe("the enforced CSP", () => {
  it("is the only policy header the middleware sets", () => {
    // Keyed on the header-setting call, not the file text: the comment above
    // cspHeader names the deleted header to explain why it is gone, and a
    // whole-file regex indicts that explanation.
    expect(proxy).not.toMatch(/headers\.set\(\s*['"]Content-Security-Policy-Report-Only/);
    expect(proxy).toMatch(/headers\.set\(\s*['"]Content-Security-Policy['"]/);
    // The report sink stays, so re-adding a report-only policy costs one header
    // and nothing else — see the comment above cspHeader for why it is not there.
    expect(read("src/app/api/csp-report/route.ts")).toMatch(/csp-report/);
  });

  it("keeps the directives that cost the app nothing", () => {
    expect(directives.get("object-src")).toBe("'none'");
    expect(directives.get("base-uri")).toBe("'self'");
    // No <object>, <embed> or <base> anywhere in src.
    const offenders = ["<object", "<embed", "<base "];
    const hits: string[] = [];
    walkSource("src", (file, text) => {
      for (const o of offenders) if (text.includes(o)) hits.push(`${file}: ${o}`);
    });
    expect(hits).toEqual([]);
  });

  it("does not allow insecure image loads", () => {
    expect(directives.get("img-src") ?? "").not.toContain("http:");
  });

  it("allows exactly the external hosts that are disclosed and justified", () => {
    const hosts = new Set<string>();
    for (const [name, value] of directives) {
      if (name === "default-src") continue;
      for (const h of externalHosts(value)) hosts.add(h);
    }
    const undisclosed = [...hosts].filter((h) => !(h in HOST_DISCLOSURE));
    expect(undisclosed, `CSP hosts with no disclosure decision: ${undisclosed.join(", ")}`).toEqual([]);
    const stale = Object.keys(HOST_DISCLOSURE).filter((h) => !hosts.has(h));
    expect(stale, `disclosure map names absent hosts: ${stale.join(", ")}`).toEqual([]);
  });

  it("discloses every allowed host on the privacy page, and no host it does not allow", () => {
    for (const [host, pattern] of Object.entries(HOST_DISCLOSURE)) {
      expect(privacy, `${host} is allowed but not disclosed`).toMatch(pattern);
    }
    // The Google Fonts origins were the counter-example this pins.
    expect(privacy).not.toMatch(/fonts\.googleapis\.com|fonts\.gstatic\.com/);
    expect(directives.get("style-src") ?? "").not.toContain("fonts.googleapis.com");
    expect(directives.get("font-src") ?? "").not.toContain("fonts.gstatic.com");
  });

  it("justifies jsDelivr against the dependency that actually fetches it", () => {
    // Re-read the installed default rather than trusting this comment. If the
    // dependency ever bundles Monaco locally, this fails and the host can go.
    const loaderConfig = read("node_modules/@monaco-editor/loader/lib/es/config/index.js");
    expect(loaderConfig).toMatch(/cdn\.jsdelivr\.net\/npm\/monaco-editor/);
    expect(directives.get("script-src") ?? "").toContain("https://cdn.jsdelivr.net");
  });
});

describe("why style-src still needs 'unsafe-inline'", () => {
  const inlineStyles = (() => {
    let count = 0;
    let files = 0;
    walkSource("src", (_file, text) => {
      const before = count;
      const sf = ts.createSourceFile("x.tsx", text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
      (function visit(node: ts.Node) {
        if (ts.isJsxAttribute(node) && node.name.getText() === "style") count += 1;
        ts.forEachChild(node, visit);
      })(sf);
      if (count > before) files += 1;
    });
    return { count, files };
  })();

  it("finds a non-trivial inline-style surface, which is the stated reason", () => {
    expect(inlineStyles.count).toBeGreaterThan(0);
    // Guards against a vacuous walk: a parser that matched nothing would also
    // "prove" the policy is justified.
    expect(inlineStyles.files).toBeGreaterThan(10);
  });

  it("drops 'unsafe-inline' the moment the surface is gone", () => {
    const allows = (directives.get("style-src") ?? "").includes("'unsafe-inline'");
    if (inlineStyles.count === 0) {
      expect(allows, `${inlineStyles.files} files still carry inline styles but the policy no longer needs to allow it`).toBe(false);
    } else {
      expect(allows, `inline styles exist in ${inlineStyles.files} files; removing the allowance breaks rendering`).toBe(true);
    }
  });
});
