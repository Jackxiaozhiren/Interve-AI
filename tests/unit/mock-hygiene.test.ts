/**
 * A mock of the AI SDK has to stay partial.
 *
 * On 2026-10-09 `classify-error.ts` gained three more imports from "ai"
 * (`NoOutputGeneratedError`, `MessageConversionError`, `InvalidMessageRoleError`).
 * `tests/unit/degradation-matrix.test.ts` mocked that module with a closed
 * factory — it listed the two functions and one error brand it knew about — so
 * the new names resolved to `undefined` and three route-tier tests died inside
 * *production* code, on a line none of them touched.
 *
 * The interesting property is not which exports exist today. `src/lib` is free
 * to import more of the SDK next week, and a mock that enumerates exports is a
 * second, unenforced copy of the module's surface. So the rule is structural: a
 * factory passed to `vi.mock("ai…")` must take the `importOriginal` callback,
 * call it, and spread what comes back — so an added import resolves whether or
 * not this suite knows about it.
 *
 * Read as an AST, not a substring: a `...actual` in a comment, or a factory that
 * calls `importOriginal` and then discards it, is the shape a text scan certifies
 * and a parse tree does not.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import ts from "typescript";
import { describe, expect, it } from "vitest";

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(new URL(`../../${dir}`, import.meta.url))) {
    const rel = `${dir}/${entry}`;
    if (statSync(new URL(`../../${rel}`, import.meta.url)).isDirectory()) out.push(...walk(rel));
    else if (rel.endsWith(".ts")) out.push(rel);
  }
  return out;
}

interface SdkMock {
  file: string;
  line: number;
  callsImportOriginal: boolean;
  spreadsOriginal: boolean;
}

/** `vi.mock("ai", factory)` sites, with the two properties the rule needs. */
function collectSdkMocks(rel: string, src: string): SdkMock[] {
  const sf = ts.createSourceFile(rel, src, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const sites: SdkMock[] = [];

  const visit = (node: ts.Node) => {
    const isViMock =
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression) &&
      node.expression.name.text === "mock" &&
      node.expression.expression.getText(sf) === "vi";
    const mod = ts.isCallExpression(node) ? node.arguments[0] : undefined;
    const isSdk =
      mod !== undefined && ts.isStringLiteral(mod) && (mod.text === "ai" || mod.text.startsWith("ai/"));

    if (isViMock && isSdk && ts.isCallExpression(node) && node.arguments.length > 1) {
      const factory = node.arguments[1];
      const isFn = ts.isArrowFunction(factory) || ts.isFunctionExpression(factory);
      const cbName =
        isFn && factory.parameters[0] && ts.isIdentifier(factory.parameters[0].name)
          ? factory.parameters[0].name.text
          : null;

      // Names bound to the awaited callback: `const actual = await importOriginal()`.
      const bound = new Set<string>();
      let calls = false;
      if (cbName && isFn) {
        const scan = (n: ts.Node) => {
          if (ts.isCallExpression(n) && ts.isIdentifier(n.expression) && n.expression.text === cbName) {
            calls = true;
          }
          if (ts.isVariableDeclaration(n) && n.initializer && cbName) {
            const init = ts.isAwaitExpression(n.initializer) ? n.initializer.expression : n.initializer;
            if (
              ts.isCallExpression(init) &&
              ts.isIdentifier(init.expression) &&
              init.expression.text === cbName &&
              ts.isIdentifier(n.name)
            ) {
              bound.add(n.name.text);
            }
          }
          n.forEachChild(scan);
        };
        scan(factory);
      }

      // A spread of the callback's own (unwrapped) value or of anything bound to it.
      let spreads = false;
      if (isFn) {
        const findSpread = (n: ts.Node) => {
          if (ts.isSpreadAssignment(n) || ts.isSpreadElement(n)) {
            const e = n.expression;
            const target = ts.isAwaitExpression(e) ? e.expression : e;
            if (ts.isIdentifier(target) && (target.text === cbName || bound.has(target.text))) {
              spreads = true;
            }
          }
          n.forEachChild(findSpread);
        };
        findSpread(factory);
      }

      sites.push({
        file: rel,
        line: sf.getLineAndCharacterOfPosition(factory.getStart(sf)).line + 1,
        callsImportOriginal: calls,
        spreadsOriginal: spreads,
      });
    }
    node.forEachChild(visit);
  };

  visit(sf);
  return sites;
}

const SITES = walk("tests").flatMap((f) =>
  collectSdkMocks(f, readFileSync(new URL(`../../${f}`, import.meta.url), "utf8"))
);

describe("an AI SDK mock stays partial", () => {
  it("has SDK mock factories to judge", () => {
    // Non-vacuity derived from the scan itself: with no sites the per-site checks
    // below would pass on nothing.
    expect(SITES.length, 'no vi.mock("ai…", factory) found under tests/').toBeGreaterThan(0);
  });

  it.each(SITES.map((s) => [`${s.file}:${s.line}`, s] as const))(
    "%s calls importOriginal and spreads it",
    (label, site) => {
      expect(site.callsImportOriginal, `${label}: the factory never calls its importOriginal argument`).toBe(true);
      expect(
        site.spreadsOriginal,
        `${label}: enumerating SDK exports re-creates the 2026-10-09 break — src/lib may import a name this mock never listed`
      ).toBe(true);
    }
  );

  it("reads the shape, not the words: controls for both properties", () => {
    // The rule is only worth having if it can tell a real partial mock from a
    // mention of one. These two sources exist only in memory.
    const commentOnly = collectSdkMocks(
      "fixture.ts",
      [
        'vi.mock("ai", async (importOriginal) => {',
        "  // a closed factory: pretend ...actual lives here",
        "  return { generateObject: vi.fn() };",
        "});",
      ].join("\n")
    );
    expect(commentOnly).toHaveLength(1);
    expect(commentOnly[0].callsImportOriginal, "a comment naming the callback is not a call").toBe(false);
    expect(commentOnly[0].spreadsOriginal, "a comment containing ...actual is not a spread").toBe(false);

    const indirect = collectSdkMocks(
      "fixture.ts",
      [
        'vi.mock("ai", async (orig) => {',
        "  const real = await orig();",
        "  return { ...real, generateText: vi.fn() };",
        "});",
      ].join("\n")
    );
    expect(indirect).toHaveLength(1);
    expect(indirect[0].callsImportOriginal, "the callback under another name still counts").toBe(true);
    expect(indirect[0].spreadsOriginal, "spreading the bound value still counts").toBe(true);
  });
});
