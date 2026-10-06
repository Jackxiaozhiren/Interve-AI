/**
 * Who is allowed to compute the hesitation total that gets displayed.
 *
 * The room runs two speech engines over one microphone (browser
 * `SpeechRecognition` drafts + Whisper finals), and both count the same spoken
 * fillers. Before `delivery-ledger.ts` each call site added its own count to a
 * page-local accumulator, so a browser result landing after the Whisper commit
 * double-counted — which is the ordinary ordering, not a race. `delivery-ledger`
 * holds the rule; *this* file polices that the app still routes through it,
 * because a unit test on the ledger cannot notice a new call site that bypasses
 * it.
 *
 * Predicate, per `setFillerWordsCount(x)` in the files that own the interview
 * room's speech plumbing:
 *   - `x` must be a call on `deliveryLedgerRef.current.*`, or
 *   - it is red — including a plain number. A reset belongs in the ledger too
 *     (`seed(0)`), because the only way a call-site write and the ledger can
 *     disagree is for one to write and the other to own, which is exactly how
 *     the double-count and the restore-clobber got in.
 *
 * The file list, not the page, is the scope: the Whisper commit moved to
 * `engine-dispatch.ts` when the worker handlers were extracted, and a guard that
 * only reads the page would have quietly watched the count of commit sites drop
 * to one and called that progress. Counts are asserted over the union, so a
 * second commit owner in *either* file is red.
 */
import { readFileSync } from "node:fs";
import ts from "typescript";
import { describe, expect, it } from "vitest";

const OWNERS = ["src/app/interview/page.tsx", "src/lib/interview/engine-dispatch.ts"];

interface Parsed {
  path: string;
  source: ts.SourceFile;
}

const parsed: Parsed[] = OWNERS.map((path) => ({
  path,
  source: ts.createSourceFile(
    path,
    readFileSync(new URL(`../../${path}`, import.meta.url), "utf8"),
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  ),
}));

interface SetterSite {
  args: ts.NodeArray<ts.Expression>;
  text: string;
  path: string;
}

function findCalls(name: string): SetterSite[] {
  const found: SetterSite[] = [];
  for (const { path, source } of parsed) {
    const visit = (node: ts.Node) => {
      if (
        ts.isCallExpression(node) &&
        ts.isIdentifier(node.expression) &&
        node.expression.text === name
      ) {
        found.push({ args: node.arguments, text: node.getText(source), path });
      }
      node.forEachChild(visit);
    };
    visit(source);
  }
  return found;
}

/** `deliveryLedgerRef.current.<method>(...)` */
function isLedgerCall(node: ts.Node, source: ts.SourceFile): boolean {
  if (!ts.isCallExpression(node)) return false;
  const callee = node.expression;
  if (!ts.isPropertyAccessExpression(callee)) return false;
  return callee.expression.getText(source) === "deliveryLedgerRef.current";
}

const LEDGER_METHODS = ["beginAnswer", "commitFinalFromWhisper", "provisionalFromDraft", "seed"];

function ledgerCallsTo(method: string): number {
  let count = 0;
  for (const { source } of parsed) {
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
  }
  return count;
}

describe(`filler-count ownership in ${OWNERS.join(" + ")}`, () => {
  it("finds the setter sites it is claiming to inspect (instrument sanity)", () => {
    const sites = findCalls("setFillerWordsCount");
    // Three today: the Whisper commit (in the dispatch), the browser draft, and
    // the localStorage restore. A count of zero would mean the probe is blind,
    // not that the code is clean.
    expect(sites.length).toBeGreaterThanOrEqual(3);
    // Both files must actually contribute, or the scope widened on paper only.
    expect(new Set(sites.map((s) => s.path)).size).toBe(OWNERS.length);
  });

  it("only ever sets the total from the ledger", () => {
    const offenders = findCalls("setFillerWordsCount")
      .filter((site) => {
        const { source } = parsed.find((p) => p.path === site.path)!;
        return site.args.length !== 1 || !isLedgerCall(site.args[0], source);
      })
      .map((site) => `${site.path}: ${site.text}`);

    expect(offenders).toEqual([]);
  });

  it("derives every total it displays from a ledger method that returns one", () => {
    // `total()` reads the ledger without writing the display, so it must not be
    // what a setter is fed — that would show a committed number while a draft is
    // in flight, and re-open the question of which engine owns the answer.
    const bare = findCalls("setFillerWordsCount").filter((site) => {
      const arg = site.args[0];
      return (
        ts.isCallExpression(arg) &&
        ts.isPropertyAccessExpression(arg.expression) &&
        arg.expression.name.text === "total"
      );
    });
    expect(bare).toEqual([]);
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
    for (const path of OWNERS) {
      expect(readFileSync(new URL(`../../${path}`, import.meta.url), "utf8"), path).not.toMatch(
        /totalFillerWordsRef/,
      );
    }
  });
});
