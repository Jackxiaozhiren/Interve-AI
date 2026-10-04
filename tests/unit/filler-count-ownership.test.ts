/**
 * Who is allowed to compute the hesitation total that gets displayed.
 *
 * The room runs two speech engines over one microphone (browser
 * `SpeechRecognition` drafts + Whisper finals), and both count the same spoken
 * fillers. Before `delivery-ledger.ts` each call site added its own count to a
 * page-local accumulator, so a browser result landing after the Whisper commit
 * double-counted — which is the ordinary ordering, not a race. `delivery-ledger`
 * holds the rule; *this* file polices that the page still routes through it,
 * because a unit test on the ledger cannot notice a new call site that bypasses
 * it.
 *
 * Predicate, per `setFillerWordsCount(x)` in src/app/interview/page.tsx:
 *   - `x` is a call on `deliveryLedgerRef.current.*`  → owned by the ledger, or
 *   - `x` contains no call and no arithmetic          → a plain value (a
 *     restored snapshot field, or a reset to 0), which the ledger cannot know, or
 *   - anything else                                   → somebody is summing
 *     filler counts at the call site again. Red.
 */
import { readFileSync } from "node:fs";
import ts from "typescript";
import { describe, expect, it } from "vitest";

const PAGE = "src/app/interview/page.tsx";

const source = ts.createSourceFile(
  PAGE,
  readFileSync(new URL(`../../${PAGE}`, import.meta.url), "utf8"),
  ts.ScriptTarget.Latest,
  true,
  ts.ScriptKind.TSX,
);

const contains = (node: ts.Node, kind: ts.SyntaxKind): boolean => {
  let hit = false;
  const walk = (n: ts.Node) => {
    if (n.kind === kind) hit = true;
    n.forEachChild(walk);
  };
  walk(node);
  return hit;
};

interface SetterSite {
  args: ts.NodeArray<ts.Expression>;
  text: string;
}

function findCalls(name: string): SetterSite[] {
  const found: SetterSite[] = [];
  const visit = (node: ts.Node) => {
    if (
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === name
    ) {
      found.push({ args: node.arguments, text: node.getText(source) });
    }
    node.forEachChild(visit);
  };
  visit(source);
  return found;
}

/** `deliveryLedgerRef.current.<method>(...)` */
function isLedgerCall(node: ts.Node): boolean {
  if (!ts.isCallExpression(node)) return false;
  const callee = node.expression;
  if (!ts.isPropertyAccessExpression(callee)) return false;
  return callee.expression.getText(source) === "deliveryLedgerRef.current";
}

const LEDGER_METHODS = ["beginAnswer", "commitFinalFromWhisper", "provisionalFromDraft"];

function ledgerCallsTo(method: string): number {
  let count = 0;
  const visit = (node: ts.Node) => {
    if (
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression) &&
      node.expression.name.text === method &&
      node.expression.expression.getText(source) === "deliveryLedgerRef.current"
    ) count += 1;
    node.forEachChild(visit);
  };
  visit(source);
  return count;
}

describe(`filler-count ownership in ${PAGE}`, () => {
  it("finds the setter sites it is claiming to inspect (instrument sanity)", () => {
    const sites = findCalls("setFillerWordsCount");
    // Three today: the two ledger paths and the localStorage restore. A count of
    // zero would mean the probe is blind, not that the code is clean.
    expect(sites.length).toBeGreaterThanOrEqual(3);
  });

  it("only ever sets the total from the ledger or from a plain value", () => {
    const offenders = findCalls("setFillerWordsCount")
      .filter((site) => site.args.length === 1)
      .filter((site) => {
        const arg = site.args[0];
        if (isLedgerCall(arg)) return false;
        const computes =
          contains(arg, ts.SyntaxKind.CallExpression) ||
          contains(arg, ts.SyntaxKind.BinaryExpression) ||
          contains(arg, ts.SyntaxKind.TemplateExpression);
        return computes;
      })
      .map((site) => site.text);

    expect(offenders).toEqual([]);
  });

  it.each(LEDGER_METHODS)("routes %s through the ledger at least once", (method) => {
    expect(ledgerCallsTo(method)).toBeGreaterThanOrEqual(1);
  });

  it("keeps exactly one commit owner and one provisional owner", () => {
    // Two engines, one commit path. A second commit call would mean a second
    // engine is entitled to author an answer's count again.
    expect(ledgerCallsTo("commitFinalFromWhisper")).toBe(1);
    expect(ledgerCallsTo("provisionalFromDraft")).toBe(1);
  });

  it("does not resurrect the parallel accumulator the ledger replaced", () => {
    expect(readFileSync(new URL(`../../${PAGE}`, import.meta.url), "utf8")).not.toMatch(
      /totalFillerWordsRef/,
    );
  });
});
