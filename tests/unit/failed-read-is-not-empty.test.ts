// A page that announces success must not have turned a failed read into "no data".
//
// `db.practiceSessions.toArray()` throws when a signed-in owner's read is refused
// (src/lib/api-client.ts:273 — `if (error) throw error`). The Privacy Center wrapped
// that call in `.catch(() => [])` in both of its account-level flows, so a failure
// arrived as an empty list, and each flow then states a categorical conclusion:
//
//   export → "已导出 / 你的面试与练习数据已下载为 JSON", with that section of the
//            file silently empty;
//   delete → the loop runs zero times, `failures` stays empty, and the page toasts
//            "云端面试、练习、简历索引与评测、评估、遥测、成就记录已清空".
//
// So the erasure promise can fail quietly: the reader cannot tell "you have none"
// from "the request was refused", and the sentence on screen asserts the first.
//
// The rules run over every client file that can announce a success rather than
// over this page by name — a guard that names its own subject cannot fail when a
// second page grows the same shape, and cannot notice when this one moves.
//
//   F1  no `.catch` yielding an empty list or object may feed a success message;
//   F2  every `catch` inside such a flow must report, record, or rethrow;
//   F3  the corpus is non-empty, and the readers fire on fixtures in both
//       spellings, so F1/F2 cannot pass by seeing nothing;
//   F4  "reports" is read off statements, never off the block's text: the first
//       draft of F2 went green because the fix's own comment sat inside the catch
//       and described the error handling in prose. Prose cannot satisfy a rule that
//       scans for the words.
import ts from "typescript";
import { describe, expect, it } from "vitest";
import { readRepo, walkRepo } from "./repo-tree";

type Sources = Map<string, string>;

const liveTree = (): Sources => {
  const map: Sources = new Map();
  for (const rel of walkRepo("src", (p) => p.endsWith(".tsx"))) map.set(rel, readRepo(rel));
  return map;
};

function parse(rel: string, source: string): ts.SourceFile {
  return ts.createSourceFile(rel, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
}

/** `a.b.c` for an identifier or property-access chain, `null` for anything else. */
function dottedName(node: ts.Expression): string | null {
  if (ts.isIdentifier(node)) return node.text;
  if (ts.isPropertyAccessExpression(node)) {
    const base = dottedName(node.expression);
    return base ? `${base}.${node.name.text}` : null;
  }
  return null;
}

function isToastSuccess(node: ts.Node): node is ts.CallExpression {
  return ts.isCallExpression(node) && dottedName(node.expression) === "toast.success";
}

/**
 * Does this block contain a statement that reports, records, or rethrows?
 *
 * Written as a walk over statements on purpose. The text of a catch block always
 * contains its comments, so the earlier regex-over-`block.getText()` version
 * accepted a comment that merely described the error handling — "the caller rethrows"
 * — as the report itself, and passed on the real page rather than only in a fixture.
 * A rule about what code does has to read code.
 */
function reports(block: ts.Block): boolean {
  const hits: string[] = [];
  const visit = (node: ts.Node) => {
    if (hits.length) return;
    if (ts.isThrowStatement(node)) {
      hits.push("throw");
      return;
    }
    if (ts.isCallExpression(node)) {
      const name = dottedName(node.expression);
      if (
        name &&
        (/^set[A-Z]/.test(name) || /^toast\.(error|warning|info)$/.test(name) || /^console\.(error|warn)$/.test(name) ||
          /\.push$/.test(name) || name === "push")
      ) {
        hits.push(name);
        return;
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(block);
  return hits.length > 0;
}

/**
 * The success message announced by the nearest enclosing function, if any.
 *
 * The climb stops at the first function-like: a swallow inside a helper that an
 * announcing handler happens to call is a different decision, and folding it in
 * would flag half the app without meaning anything. The message must be a string
 * literal argument — the claim being policed is the sentence on screen.
 */
function announcedIn(node: ts.Node): string | null {
  let current: ts.Node | undefined = node.parent;
  while (current) {
    if (ts.isFunctionLike(current)) {
      const found: string[] = [];
      const visit = (inner: ts.Node) => {
        if (found.length) return;
        if (isToastSuccess(inner)) {
          const arg = inner.arguments[0];
          if (arg && ts.isStringLiteral(arg)) found.push(arg.text);
          return;
        }
        ts.forEachChild(inner, visit);
      };
      visit(current);
      return found[0] ?? null;
    }
    current = current.parent;
  }
  return null;
}

/** A rejection handler whose entire body is `[]`, `{}`, or `return []`. */
function swallowsToEmpty(node: ts.Node): boolean {
  if (!(ts.isArrowFunction(node) || ts.isFunctionExpression(node))) return false;
  const body = node.body;
  if (isEmptyLiteral(body)) return true;
  if (ts.isBlock(body)) {
    const statement = body.statements.length === 1 ? body.statements[0] : undefined;
    return !!statement && ts.isReturnStatement(statement) && !!statement.expression && isEmptyLiteral(statement.expression);
  }
  return false;
}

function isEmptyLiteral(node: ts.Node): boolean {
  return (
    (ts.isArrayLiteralExpression(node) && node.elements.length === 0) ||
    (ts.isObjectLiteralExpression(node) && node.properties.length === 0)
  );
}

/** Every `toast.success("literal")` in a file, as code. */
function successCalls(sf: ts.SourceFile): ts.CallExpression[] {
  const out: ts.CallExpression[] = [];
  const visit = (node: ts.Node) => {
    if (isToastSuccess(node)) out.push(node);
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return out;
}

/** The files that can announce a success — the corpus both rules read. */
export function announcingPages(files: Sources): Map<string, ts.SourceFile> {
  const out = new Map<string, ts.SourceFile>();
  for (const [rel, source] of files) {
    const sf = parse(rel, source);
    if (successCalls(sf).some((call) => call.arguments[0] && ts.isStringLiteral(call.arguments[0]))) out.set(rel, sf);
  }
  return out;
}

export function emptyReadsFeedingSuccess(files: Sources): string[] {
  const out: string[] = [];
  for (const [rel, sf] of announcingPages(files)) {
    const visit = (node: ts.Node) => {
      if (
        ts.isCallExpression(node) &&
        ts.isPropertyAccessExpression(node.expression) &&
        node.expression.name.text === "catch" &&
        node.arguments[0] &&
        swallowsToEmpty(node.arguments[0])
      ) {
        const message = announcedIn(node);
        if (message) {
          out.push(`${rel}:${sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1} → "${message}"`);
        }
      }
      ts.forEachChild(node, visit);
    };
    visit(sf);
  }
  return out;
}

export function unreportedCatches(files: Sources): string[] {
  const out: string[] = [];
  for (const [rel, sf] of announcingPages(files)) {
    const visit = (node: ts.Node) => {
      if (ts.isCatchClause(node)) {
        const message = announcedIn(node);
        if (message && !reports(node.block)) {
          const line = sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1;
          out.push(`${rel}:${line} announces "${message}" and reports nothing`);
        }
      }
      ts.forEachChild(node, visit);
    };
    visit(sf);
  }
  return out;
}

const PRIVACY = "src/app/dashboard/privacy/page.tsx";

describe("a failed read is not announced as an empty account", () => {
  it("F1: no success message is fed by a rejection turned into an empty list", () => {
    const found = emptyReadsFeedingSuccess(liveTree());
    expect(found, "a refused read arrives as [] and the page states a categorical success").toEqual([]);
  });

  it("F2: every catch in an announcing flow reports, records, or rethrows", () => {
    const found = unreportedCatches(liveTree());
    expect(found, "a silent catch can hide a refused erase behind a success toast").toEqual([]);
  });
});

describe("the readers see what they claim to see", () => {
  it("F3: the corpus is the announcing pages, including the Privacy Center", () => {
    const pages = [...announcingPages(liveTree()).keys()];
    expect(pages.length, "no page announces a success at all").toBeGreaterThan(0);
    expect(pages, "the Privacy Center stopped announcing, or moved: retarget these rules").toContain(PRIVACY);
  });

  const HEAD = `\n"use client";\nimport { toast } from "sonner";\n`;

  const fixture = (body: string): Sources => new Map([["fixture.tsx", `${HEAD}${body}`]]);

  it("fires on both spellings of the swallow", () => {
    const ARROW = `export function P() {
  const exportAll = async () => {
    const rows = await db.rows.toArray().catch(() => []);
    toast.success("已导出", { description: "你的数据已下载" });
    return rows;
  };
  return null;
}
`;
    const BLOCK = `export function P() {
  const exportAll = async () => {
    const rows = await db.rows.toArray().catch(() => { return []; });
    toast.success("已导出", { description: "你的数据已下载" });
    return rows;
  };
  return null;
}
`;
    for (const [label, body] of [["arrow", ARROW], ["block body", BLOCK]] as const) {
      expect(emptyReadsFeedingSuccess(fixture(body)), `${label} spelling was missed`).toHaveLength(1);
    }
  });

  it("fires on a quiet catch, and not on one that records", () => {
    const SILENT = `export function P() {
  const erase = async () => {
    try { await db.rows.removeAll(); } catch { /* best effort */ }
    toast.success("已全部删除", { description: "记录已清空" });
  };
  return null;
}
`;
    const RECORDED = `export function P() {
  const erase = async () => {
    const failures: string[] = [];
    try { await db.rows.removeAll(); } catch (e) { failures.push(String(e)); }
    toast.success("已全部删除", { description: "记录已清空" });
    return failures;
  };
  return null;
}
`;
    expect(unreportedCatches(fixture(SILENT)), "the quiet catch was missed").toHaveLength(1);
    expect(unreportedCatches(fixture(RECORDED)), "a recording catch was flagged anyway").toEqual([]);
  });

  it("F4: a comment inside a catch is not a report", () => {
    // The shape that made the first draft pass on the live tree: the sentence
    // explaining the fix sat inside the block and named `setError(`, `throw`, and a
    // quoted `toast.error("失败")`. None of it is a statement.
    const CLAIMS = `export function P() {
  const erase = async () => {
    try {
      await db.rows.removeAll();
    } catch {
      // setError() is unnecessary: the caller rethrows, and toast.error("失败") covers it.
    }
    toast.success("已全部删除", { description: "记录已清空" });
  };
  return null;
}
`;
    // The same page with a statement in the block: so the arm turns on the
    // statement, not on the comment being absent.
    const RECORDS = `export function P() {
  const erase = async () => {
    const failures: string[] = [];
    try {
      await db.rows.removeAll();
    } catch {
      // setError() is unnecessary: the caller rethrows, and toast.error("失败") covers it.
      failures.push("rows");
    }
    toast.success("已全部删除", { description: "记录已清空" });
    return failures;
  };
  return null;
}
`;
    expect(unreportedCatches(fixture(CLAIMS)), "prose about reporting was read as reporting").toHaveLength(1);
    expect(unreportedCatches(fixture(RECORDS)), "a recording statement was still reported").toEqual([]);
  });

  it("does not fire on a swallow that cannot reach an announcement", () => {
    // A helper that returns [] for its caller, with the success sentence living in
    // another function: the rules stop at the function boundary on purpose, or
    // every list fallback in the app would be reported.
    const HELPER = `async function readRows() {
  return await db.rows.toArray().catch(() => []);
}
export function P() {
  const exportAll = async () => {
    const rows = await readRows();
    toast.success("已导出", { description: "你的数据已下载" });
    return rows;
  };
  return null;
}
`;
    expect(emptyReadsFeedingSuccess(fixture(HELPER))).toEqual([]);
  });

  it("does not treat a toast.success named in prose as an announcement", () => {
    // The corpus filter is the other half of the same defect: a file that only
    // quotes `toast.success("…")` inside a comment would otherwise join the corpus,
    // and its catches would be policed as if the page claimed anything.
    const QUOTES = `export function P() {
  // The old copy said toast.success("已导出") and that is exactly the bug.
  const exportAll = async () => {
    try { await db.rows.removeAll(); } catch { /* quiet */ }
    return null;
  };
  return null;
}
`;
    expect(announcingPages(fixture(QUOTES)).size, "a quoted announcement joined the corpus").toBe(0);
    expect(unreportedCatches(fixture(QUOTES))).toEqual([]);
  });
});
