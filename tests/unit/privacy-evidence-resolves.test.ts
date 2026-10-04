/**
 * Every technical claim on /privacy has to point at something that exists.
 *
 * The page ends its preamble with 「如果哪天代码与本页不一致，以代码为准，并请告诉我们」 —
 * it hands the reader to the code as the authority. That only means something if each
 * Evidence block actually names a hook into the code. Until now nothing checked: the
 * 30-day snapshot promise was "enforced by `SESSION_TTL_MS`", a real constant that by
 * itself deletes nothing, and the claim stayed green while abandoned transcripts sat in
 * localStorage past their stated expiry.
 *
 * So: pull every `<code>…</code>` token out of the page and resolve it. Paths must exist,
 * migrations must exist, `@scope/pkg` must be a declared dependency, and everything else
 * must occur in `src/` or the migrations. Composite prose tokens (`a / b / c`, `x = y`)
 * are split and each part must resolve.
 *
 * A token that resolves by nothing is either a lie or an exemption, and an exemption has
 * to be declared here with a reason — that is the point. A new claim cannot hide.
 */
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import ts from "typescript";
import { describe, expect, it } from "vitest";

const ROOT = new URL("../../", import.meta.url);
const read = (rel: string) => readFileSync(new URL(rel, ROOT), "utf8");

const privacy = read("src/app/privacy/page.tsx");

/**
 * Concatenated token text of every source file **except the page under audit**,
 * taken from the parse tree.
 *
 * Two ways this corpus can silently certify nothing, both found by planting the
 * defect I was guarding against:
 *
 * - reading raw file text instead of tokens certifies a claim that exists only in
 *   a comment. Not hypothetical: /privacy called the provider opt-in `?model=`,
 *   which appeared twice in `registry.ts` — in comments — while the code reads
 *   `?aiModel=`.
 * - including `/privacy` itself lets a claim resolve against its own sentence:
 *   `<code>resolveChatModell</code>` (a symbol that does not exist) matched the
 *   JSX text of the claim naming it.
 *
 * So the haystack is AST tokens, and the page under audit is excluded from it.
 */
const SELF = "src/app/privacy/page.tsx";

function tokenText(dir: string, accept: (name: string) => boolean): { tokens: string; literals: Set<string> } {
  const out: string[] = [];
  const literals = new Set<string>();
  const walk = (rel: string) => {
    for (const entry of readdirSync(new URL(rel, ROOT))) {
      const child = `${rel}/${entry}`;
      const abs = new URL(child, ROOT);
      if (statSync(abs).isDirectory()) {
        if (entry === "node_modules" || entry === ".next") continue;
        walk(child);
      } else if (accept(entry) && child !== SELF) {
        const sf = ts.createSourceFile(
          child,
          read(child),
          ts.ScriptTarget.Latest,
          true,
          entry.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS
        );
        const visit = (n: ts.Node) => {
          if (ts.isToken(n)) out.push(n.getText(sf));
          if (ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n)) literals.add(n.text);
          if (ts.isTemplateExpression(n)) {
            literals.add(n.head.text);
            n.templateSpans.forEach((s) => literals.add(s.literal.text));
          }
          n.forEachChild(visit);
        };
        visit(sf);
      }
    }
  };
  walk(dir);
  return { tokens: out.join("\n"), literals };
}

const CODE = tokenText("src", (n) => /\.(ts|tsx|mjs)$/.test(n));
const CODE_TOKENS = CODE.tokens;
const STRING_LITERALS = CODE.literals;
const SQL_TEXT = gather("supabase", (n) => n.endsWith(".sql"));
const HAYSTACK = `${CODE_TOKENS}\n${SQL_TEXT}`;
const pkg = JSON.parse(read("package.json")) as { dependencies?: Record<string, string> };

function gather(dir: string, filter: (name: string) => boolean): string {
  const out: string[] = [];
  const walk = (rel: string) => {
    for (const entry of readdirSync(new URL(rel, ROOT))) {
      const child = `${rel}/${entry}`;
      const abs = new URL(child, ROOT);
      if (statSync(abs).isDirectory()) {
        if (entry === "node_modules" || entry === ".next") continue;
        walk(child);
      } else if (filter(entry)) out.push(read(child));
    }
  };
  walk(dir);
  return out.join("\n");
}

/**
 * Tokens that resolve to nothing in code, each with why that is correct.
 * Anything not listed and not resolvable is a red test, so this stays small and
 * honest. It is empty today: every `<code>` token on the page names something the
 * compiler can see. Adding an entry here is a declaration that a privacy claim
 * rests on something other than code, and it should be rare.
 */
const EXEMPT: Record<string, string> = {};

const tokens = [...new Set(
  [...privacy.matchAll(/<code>([^<]+)<\/code>/g)].map((m) => m[1].trim())
)];

function atoms(token: string): string[] {
  return token
    .split(/\s*\/\s*|\s*=\s*|\s+/)
    .map((a) => a.replace(/[*`;']/g, "").replace(/^\?/, "").replace(/=/g, "").trim())
    .filter((a) => a.length > 2);
}

function resolve(token: string): { ok: boolean; how: string } {
  if (EXEMPT[token]) return { ok: true, how: `exempt: ${EXEMPT[token]}` };
  if (/^(src|tests|docs|supabase)\//.test(token)) {
    return { ok: existsSync(new URL(token, ROOT)), how: "path" };
  }
  if (token.endsWith(".sql")) {
    return { ok: existsSync(new URL(`supabase/migrations/${token}`, ROOT)), how: "migration" };
  }
  if (token.startsWith("@") && token.includes("/")) {
    const name = token.split("/").slice(0, 2).join("/");
    return { ok: Boolean(pkg.dependencies?.[name]), how: `declared dependency ${name}` };
  }
  const param = /^\?([\w-]+)=?$/.exec(token);
  if (param) {
    // A URL parameter is data, not a symbol: it has to be read somewhere, which
    // means a string literal. `?model=` normalized to the identifier `model`
    // (which is everywhere) and passed; that is exactly the false certificate the
    // page shipped with.
    return {
      ok: STRING_LITERALS.has(param[1]),
      how: `query parameter read as the literal "${param[1]}"`,
    };
  }
  if (token.startsWith("Xenova/")) {
    return { ok: HAYSTACK.includes(token), how: "model id referenced in source" };
  }
  const parts = atoms(token);
  if (parts.length === 0) return { ok: false, how: `no resolvable atom in "${token}"` };
  const missing = parts.filter((p) => !HAYSTACK.includes(p));
  return { ok: missing.length === 0, how: missing.length ? `missing: ${missing.join(", ")}` : `occurs in code tokens or migrations (${parts.length} atom(s))` };
}

describe("every /privacy evidence token resolves", () => {
  it("finds the tokens it is claiming to check (instrument sanity)", () => {
    // A regex that matches nothing would make every assertion below vacuous.
    expect(tokens.length).toBeGreaterThanOrEqual(20);
    expect(CODE_TOKENS.length).toBeGreaterThan(100_000);
  });

  it("is blind to comments and to the page itself (controls)", () => {
    // Comment-blindness: registry.ts describes the opt-in as `?aiModel=openrouter`
    // in a comment only, so no source token spells that phrase.
    expect(read("src/ai/providers/registry.ts")).toContain("?aiModel=openrouter");
    expect(CODE_TOKENS).not.toContain("?aiModel=openrouter");
    // Self-exclusion: a claim must not resolve against its own sentence.
    expect(privacy).toContain("以代码为准");
    expect(CODE_TOKENS).not.toContain("以代码为准");
    // And the corpus really does contain code.
    expect(CODE_TOKENS).toContain("aiModel");
  });

  it("has at least one token resolved by each mechanism", () => {
    const hows = tokens.map((t) => resolve(t).how);
    expect(hows.some((h) => h === "path"), "no path token").toBe(true);
    expect(hows.some((h) => h === "migration"), "no migration token").toBe(true);
    expect(hows.some((h) => h.startsWith("declared dependency")), "no dependency token").toBe(true);
    expect(hows.some((h) => h.startsWith("occurs in")), "no identifier token").toBe(true);
  });

  const unresolved = tokens.map((t) => ({ token: t, ...resolve(t) })).filter((r) => !r.ok);

  it("resolves all of them, or names what to fix", () => {
    expect(
      unresolved.map((u) => `${u.token} -> ${u.how}`),
      "a privacy claim that points at nothing cannot be believed by a reader who is told to check the code"
    ).toEqual([]);
  });

  it("requires each Evidence block to name at least one code-resolvable hook", () => {
    const blocks = [...privacy.matchAll(/<Evidence>([\s\S]*?)<\/Evidence>/g)].map((m) => m[1]);
    expect(blocks.length).toBeGreaterThanOrEqual(8);
    const bare = blocks
      .map((b, i) => ({ i, names: [...b.matchAll(/<code>([^<]+)<\/code>/g)].map((m) => m[1].trim()) }))
      .filter((b) => b.names.length === 0 || b.names.every((n) => EXEMPT[n]));
    expect(bare.map((b) => b.i), "an Evidence block with no code hook is prose only").toEqual([]);
  });
});
