/**
 * Every store the Privacy Center lists must be one it can actually empty.
 *
 * The inventory table is the promise the page makes to a candidate: this data,
 * in this place, gone when you delete. It was found broken — the resume is also
 * stored as a serialized search index (`orama_index`), a second copy of the
 * whole document, and nothing in the codebase could delete that row: the client
 * wrapper had `get` and `put` only, and no erase path mentioned it. So the table
 * implied an erasure it could not deliver, and the row describing resume text
 * said "until you delete the session" about data that survived every deletion.
 *
 * Predicates, on the parse tree of the real source:
 *   1. every table named in an inventory `where:` string has a `.delete()` for
 *      that table in `src/lib/api-client.ts`;
 *   2. every such table is reachable from `deleteAll` — either
 *      `db.<accessor>.remove(...)` in that function, or a call to an exported
 *      function of this app whose body performs that removal;
 *   3. every localStorage store named in the table is covered by the prefix list
 *      the local sweep uses.
 *
 * An inventory row that outpaces the code is therefore red, in both directions:
 * a new table with no delete, and a new table with a delete nobody calls.
 */
import fs from "node:fs";
import path from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";

const CLIENT = "src/lib/api-client.ts";
const PAGE = "src/app/dashboard/privacy/page.tsx";

function parse(rel: string) {
  const text = fs.readFileSync(path.join(process.cwd(), rel), "utf8");
  return { text, source: ts.createSourceFile(rel, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX) };
}

function srcFiles(dir = "src"): string[] {
  const out: string[] = [];
  const walk = (d: string) => {
    for (const entry of fs.readdirSync(d, { withFileTypes: true })) {
      const full = path.join(d, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (/\.(ts|tsx)$/.test(entry.name)) out.push(path.relative(process.cwd(), full));
    }
  };
  walk(dir);
  return out;
}

/** table names targeted by some `.delete()` in the client */
function deletableTables(source: ts.SourceFile): Set<string> {
  const out = new Set<string>();
  const visit = (node: ts.Node) => {
    if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression) && node.expression.name.text === "delete") {
      const inner = node.expression.expression;
      if (
        ts.isCallExpression(inner) &&
        ts.isPropertyAccessExpression(inner.expression) &&
        inner.expression.name.text === "from" &&
        inner.arguments[0] &&
        ts.isStringLiteral(inner.arguments[0])
      ) out.add(inner.arguments[0].text);
    }
    node.forEachChild(visit);
  };
  source.forEachChild(visit);
  return out;
}

/** accessor variable -> tables it writes */
function accessorTables(source: ts.SourceFile): Map<string, Set<string>> {
  const map = new Map<string, Set<string>>();
  for (const stmt of source.statements) {
    if (!ts.isVariableStatement(stmt)) continue;
    for (const decl of stmt.declarationList.declarations) {
      if (!ts.isIdentifier(decl.name) || !decl.initializer || !ts.isObjectLiteralExpression(decl.initializer)) continue;
      const tables = new Set<string>();
      const visit = (node: ts.Node) => {
        if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression) && ["upsert", "insert"].includes(node.expression.name.text)) {
          const inner = node.expression.expression;
          if (
            ts.isCallExpression(inner) &&
            ts.isPropertyAccessExpression(inner.expression) &&
            inner.expression.name.text === "from" &&
            inner.arguments[0] &&
            ts.isStringLiteral(inner.arguments[0])
          ) tables.add(inner.arguments[0].text);
        }
        node.forEachChild(visit);
      };
      decl.initializer.forEachChild(visit);
      if (tables.size) map.set(decl.name.text, tables);
    }
  }
  return map;
}

function accessorFor(table: string, accessors: Map<string, Set<string>>): string | null {
  for (const [name, tables] of accessors) if (tables.has(table)) return name;
  return null;
}

/** every exported function in src/, name -> body text */
function exportedFunctions(): Map<string, string> {
  const out = new Map<string, string>();
  for (const rel of srcFiles()) {
    const { source } = parse(rel);
    const visit = (node: ts.Node) => {
      if (ts.isFunctionDeclaration(node) && node.name && node.body) {
        if (node.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword)) out.set(node.name.text, node.body.getText(source));
      }
      if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer && ts.isArrowFunction(node.initializer)) {
        const parent = node.parent.parent;
        const isExported = ts.isVariableStatement(parent) && parent.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword);
        if (isExported) out.set(node.name.text, node.initializer.getText(source));
      }
      node.forEachChild(visit);
    };
    source.forEachChild(visit);
  }
  return out;
}

function inventory(): { tables: string[]; locals: string[] } {
  const { source } = parse(PAGE);
  const tables: string[] = [];
  const locals: string[] = [];
  const visit = (node: ts.Node) => {
    if (ts.isPropertyAssignment(node) && node.name.getText(source) === "where") {
      const text = node.initializer.getText(source);
      for (const m of text.matchAll(/Database \((\w+)/g)) tables.push(m[1]);
      for (const m of text.matchAll(/(interve_[a-z_]+)/g)) locals.push(m[1]);
    }
    node.forEachChild(visit);
  };
  source.forEachChild(visit);
  return { tables: [...new Set(tables)], locals: [...new Set(locals)] };
}

function functionBody(rel: string, name: string): string {
  const { source } = parse(rel);
  let found = "";
  const visit = (node: ts.Node) => {
    if (ts.isVariableDeclaration(node) && node.name.getText(source) === name && node.initializer) found = node.initializer.getText(source);
    node.forEachChild(visit);
  };
  source.forEachChild(visit);
  return found;
}

function localPrefixes(): string[] {
  const { source } = parse(PAGE);
  const out: string[] = [];
  const visit = (node: ts.Node) => {
    if (ts.isVariableDeclaration(node) && node.name.getText(source) === "LOCAL_DATA_PREFIXES" && node.initializer) {
      for (const m of node.initializer.getText(source).matchAll(/"([^"]+)"/g)) out.push(m[1]);
    }
    node.forEachChild(visit);
  };
  source.forEachChild(visit);
  return out;
}

const client = parse(CLIENT);
const deletable = deletableTables(client.source);
const accessors = accessorTables(client.source);
const helpers = exportedFunctions();
const listing = inventory();
const eraseBody = functionBody(PAGE, "deleteAll");

describe("the probe itself (each clause must be able to fail)", () => {
  it("reads the real inventory rather than a hand-written list", () => {
    expect(listing.tables.length).toBeGreaterThanOrEqual(2);
    expect(listing.tables).toContain("interviews");
    expect(listing.tables).toContain("practice_sessions");
    expect(listing.locals).toContain("interve_session_");
  });

  it("recognises a delete by table name only", () => {
    expect(deletable.has("interviews")).toBe(true);
    expect(deletable.has("practice_sessions")).toBe(true);
    expect(deletable.has("no_such_table")).toBe(false);
  });

  it("sees the client wrapper that was missing an erasure", () => {
    const accessor = accessorFor("orama_index", accessors);
    expect(accessor).toBe("oramaIndex");
    // The gap this change closed: the wrapper used to expose get and put only.
    expect(deletable.has("orama_index")).toBe(true);
    expect(eraseBody).not.toContain("db.oramaIndex.remove");
    expect(helpers.get("deleteKnowledgeHub")).toContain("oramaIndex.remove");
  });

  it("finds an indirect erasure and not an unrelated same-name string", () => {
    const reached = [...helpers].some(([name, body]) => eraseBody.includes(`${name}(`) && body.includes("oramaIndex.remove"));
    expect(reached).toBe(true);
    expect(eraseBody.includes("db.oramaIndex.remove")).toBe(false);
  });

  it("keeps the local sweep list real", () => {
    expect(localPrefixes().length).toBeGreaterThanOrEqual(3);
    expect(localPrefixes()).toContain("interve_session_");
  });
});

describe("the Privacy Center can empty every store it names", () => {
  it("every inventoried database table has a delete in the client", () => {
    expect(listing.tables.filter((t) => !deletable.has(t))).toEqual([]);
  });

  it("every inventoried table is reachable from deleteAll, directly or through one helper", () => {
    const unreachable = listing.tables.filter((table) => {
      const accessor = accessorFor(table, accessors);
      if (!accessor) return true;
      if (eraseBody.includes(`db.${accessor}.remove`)) return false;
      return ![...helpers].some(([name, body]) => eraseBody.includes(`${name}(`) && body.includes(`${accessor}.remove`));
    });
    expect(unreachable).toEqual([]);
  });

  it("every localStorage store named in the table is covered by the local sweep", () => {
    const prefixes = localPrefixes();
    expect(listing.locals.filter((k) => !prefixes.some((p) => k.startsWith(p)))).toEqual([]);
  });
});
