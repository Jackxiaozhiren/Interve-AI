/**
 * Where an expensive whole-repo probe is allowed to run.
 *
 * `collectFacts()` walks every file under src/ and parses each one with the
 * TypeScript compiler — ~1.4s on an idle machine, more when 91 test files are
 * competing for the CPU. Vitest gives a test 5s by default and the timeout is
 * measured against the test body only, so calling it *inside* a test made the
 * gate fail on a busy runner with "Test timed out in 5000ms" while the debt
 * number it was checking had not moved at all. Two files did that and both went
 * red together; re-running made them green, which is the worst possible property
 * for a gate that exists to say something about the code.
 *
 * Module scope is not timed the same way, so the rule is: derive the facts at
 * collection time, assert on them inside the test.
 */
import { readdirSync, readFileSync } from "node:fs";
import ts from "typescript";
import { describe, expect, it } from "vitest";

const TIMED = new Set(["it", "test", "beforeAll", "beforeEach", "afterAll", "afterEach"]);

function testFiles(dir: string): string[] {
  return readdirSync(new URL(dir, import.meta.url))
    .filter((f) => /\.test\.[tm]sx?$/.test(f))
    .map((f) => `${dir}${f}`);
}

interface Offender {
  file: string;
  inside: string;
}

interface Scan {
  offenders: Offender[];
  calls: number;
}

function scan(rel: string): Scan {
  const found: Offender[] = [];
  let calls = 0;
  const file = readFileSync(new URL(rel, import.meta.url), "utf8");
  const sf = ts.createSourceFile(rel, file, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);

  const visit = (node: ts.Node, timedBy: string | null) => {
    let current = timedBy;
    if (
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      TIMED.has(node.expression.text)
    ) {
      current = node.expression.text;
    }
    if (
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === "collectFacts"
    ) {
      calls += 1;
      if (current !== null) found.push({ file: rel, inside: current });
    }
    node.forEachChild((child) => visit(child, current));
  };
  visit(sf, null);
  return { offenders: found, calls };
}

describe("expensive probes stay out of timed callbacks", () => {
  const files = testFiles("./");

  it("looks at more than one test file (instrument sanity)", () => {
    expect(files.length).toBeGreaterThan(50);
  });

  it("sees collectFacts() calls well enough to classify them (positive control)", () => {
    // Without this, an unwalked tree or a wrong path would report "no offenders"
    // exactly as a clean suite does. These files do call it, at module scope.
    for (const rel of ["./facts-ratchet.test.ts", "./any-escapes.test.ts", "./fetch-call-sites.test.ts"]) {
      const { offenders, calls } = scan(rel);
      expect(calls, `${rel} should contain a collectFacts() call`).toBeGreaterThan(0);
      expect(offenders, `${rel} keeps it out of a timed callback`).toEqual([]);
    }
  });

  it("keeps collectFacts() out of it/test/hook bodies across tests/unit", () => {
    const all = files.flatMap((f) => scan(`./${f}`).offenders);
    expect(all).toEqual([]);
  });
});
