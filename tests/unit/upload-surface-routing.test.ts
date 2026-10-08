/**
 * Upload copy has to point at the thing that can upload.
 *
 * `/dashboard/knowledge` told users to "Upload your documents from the
 * homepage" and both of its calls to action linked to `/` — the marketing page,
 * which has no upload control of any kind. The app has exactly one file input
 * (`type="file"`, in `components/setup/ResumeIntegrationSections.tsx`) and it is
 * reached from `/setup`, so any instruction to upload that does not lead there
 * sends the user to a dead end that looks like a product decision.
 *
 * Three predicates, deliberately boring:
 *   1. the upload surface is one file, named — a second input appearing
 *      somewhere else is a fork in the contract, not a feature;
 *   2. `/setup` actually reaches it, by following the import graph rather than
 *      trusting a comment that says so;
 *   3. every page whose copy instructs the user to upload links to a route that
 *      reaches an upload surface.
 *
 * Rule 3 keys on prose, so it carries its own coverage floor: the trigger must
 * still match at least two pages. A regex that quietly stops matching anything
 * would otherwise turn the rule green by going blind.
 */
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";

function walkTs(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(new URL(`../../${dir}`, import.meta.url))) {
    const rel = `${dir}/${entry}`;
    if (statSync(new URL(`../../${rel}`, import.meta.url)).isDirectory()) out.push(...walkTs(rel));
    else if (/\.(ts|tsx)$/.test(entry)) out.push(rel);
  }
  return out;
}

const SRC = walkTs("src");
const cache = new Map<string, string>();
const read = (f: string): string => {
  const hit = cache.get(f);
  if (hit !== undefined) return hit;
  const body = readFileSync(new URL(`../../${f}`, import.meta.url), "utf8");
  cache.set(f, body);
  return body;
};

// ── 1. one upload surface, by name ──────────────────────────────────────────
/**
 * Found through the parse tree, not by grepping text. A text scan counts prose:
 * the comment this file's own sibling page carries the words `type="file"` in
 * it, and a regex over source found that comment and called it an input.
 */
function hasFileInput(file: string): boolean {
  const src = read(file);
  if (!src.includes("file")) return false;
  const sf = ts.createSourceFile(file, src, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let found = false;
  const visit = (node: ts.Node): void => {
    if (found) return;
    if (ts.isJsxAttribute(node) && node.name.getText(sf) === "type") {
      const init = node.initializer;
      const value =
        init && ts.isStringLiteral(init)
          ? init.text
          : init && ts.isJsxExpression(init) && init.expression && ts.isStringLiteralLike(init.expression)
            ? init.expression.text
            : null;
      if (value === "file") found = true;
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return found;
}

const fileInputOwners = SRC.filter(hasFileInput);

// ── 2. who imports whom, resolved inside src/ ───────────────────────────────
function resolveSpecifier(from: string, spec: string): string | null {
  const base = spec.startsWith("@/") ? `src/${spec.slice(2)}` : null;
  const rel = base ?? (spec.startsWith("./") || spec.startsWith("../") ? `${from.replace(/[^/]+$/, "")}${spec}` : null);
  if (!rel) return null;
  // Normalize before testing: an unnormalized `a/../../b` is a *different string*
  // on every hop even though it names the same file, so a graph walk that skips
  // this never revisits a node, grows its keys without bound and dies in the
  // heap — measured, not theorised: this test OOMed at 3.5 GB on the first run.
  const clean = path.posix.normalize(rel);
  for (const candidate of [`${clean}.tsx`, `${clean}.ts`, `${clean}/index.tsx`, `${clean}/index.ts`]) {
    if (existsSync(new URL(`../../${candidate}`, import.meta.url))) return candidate;
  }
  return null;
}

function importsOf(file: string): string[] {
  const src = read(file);
  const sf = ts.createSourceFile(file, src, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const out: string[] = [];
  const visit = (node: ts.Node): void => {
    let spec: string | null = null;
    if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) spec = node.moduleSpecifier.text;
    else if (ts.isCallExpression(node) && node.arguments[0] && ts.isStringLiteral(node.arguments[0])
      && (node.expression.getText(sf) === "import" || /(^|\.)dynamic$/.test(node.expression.getText(sf)))) {
      spec = node.arguments[0].text;
    }
    if (spec) {
      const resolved = resolveSpecifier(file, spec);
      if (resolved) out.push(resolved);
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return out;
}

function reachableFrom(entry: string): Set<string> {
  const seen = new Set<string>([entry]);
  const queue = [entry];
  while (queue.length > 0) {
    for (const next of importsOf(queue.shift() as string)) {
      if (seen.has(next)) continue;
      seen.add(next);
      queue.push(next);
    }
  }
  return seen;
}

const SETUP_PAGE = "src/app/setup/page.tsx";
const setupReach = reachableFrom(SETUP_PAGE);

// ── 3. pages that instruct an upload, and where they send the user ──────────
const INSTRUCTION = /upload your documents|upload your resume|上传简历|上传您的简历/i;

function routePages(): string[] {
  return SRC.filter((f) => f.startsWith("src/app/") && /(^|\/)page\.tsx$/.test(f));
}

function hrefsIn(file: string): string[] {
  const src = read(file);
  const sf = ts.createSourceFile(file, src, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const out: string[] = [];
  const visit = (node: ts.Node): void => {
    if (ts.isJsxAttribute(node) && node.name.getText(sf) === "href") {
      const init = node.initializer;
      const lit =
        init && ts.isStringLiteral(init)
          ? init.text
          : init && ts.isJsxExpression(init) && init.expression && ts.isStringLiteralLike(init.expression)
            ? init.expression.text
            : null;
      if (lit) out.push(lit);
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return out;
}

/** Routes from `entry` that reach a component owning a file input. */
function uploadRoutes(entry: string): string[] {
  const reach = reachableFrom(entry);
  const hit = [...reach].filter(hasFileInput);
  return hit;
}

describe("upload instructions lead to the upload surface", () => {
  it("has exactly one component that can pick a file, and it is named", () => {
    expect(fileInputOwners).toEqual(["src/components/setup/ResumeIntegrationSections.tsx"]);
  });

  it("reaches that component from /setup, by the import graph rather than by claim", () => {
    // The *upload surface* has to be reachable, not merely the file: renaming
    // the input to something else must take this red, which checking the path
    // alone would not have done.
    expect([...setupReach].filter(hasFileInput)).toEqual([
      "src/components/setup/ResumeIntegrationSections.tsx",
    ]);
    // The reachability walk itself must not be a no-op: an empty or tiny set
    // would make the line above pass on a broken resolver.
    expect(setupReach.size).toBeGreaterThan(10);
    expect([...setupReach].some((f) => f.startsWith("src/components/"))).toBe(true);
  });

  it("sends every page that tells the user to upload to a route with a file input", () => {
    const instructing = routePages().filter((f) => INSTRUCTION.test(read(f)));
    expect(instructing.length, "the prose trigger stopped matching anything").toBeGreaterThanOrEqual(2);

    const offenders = instructing
      .map((page) => {
        const targets = hrefsIn(page);
        const canUpload = targets.some((t) => t.startsWith("/setup"));
        return canUpload ? null : `${page} says "upload" but links to ${JSON.stringify(targets)}`;
      })
      .filter((v): v is string => v !== null);

    expect(offenders).toEqual([]);
  });

  it("does not let the knowledge hub fall back to the marketing homepage", () => {
    // The specific regression: `/` was the destination of both CTAs here, and it
    // has no upload control — a dead end that looks like a product decision.
    const page = "src/app/dashboard/knowledge/page.tsx";
    const targets = hrefsIn(page);
    expect(targets).toContain("/setup");
    expect(targets).not.toContain("/");
    expect(read(page)).not.toMatch(/from the homepage/);
    expect(uploadRoutes(SETUP_PAGE)).toEqual(["src/components/setup/ResumeIntegrationSections.tsx"]);
  });
});
