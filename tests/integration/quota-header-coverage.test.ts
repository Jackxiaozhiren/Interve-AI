// The quota headers exist so a candidate can see the allowance before it runs
// out. That promise is only true if every success path stamps them — and the
// failure mode is silent: a route that forgets simply returns a response with
// no `RateLimit-Remaining`, which the client renders as "no reading" rather
// than as a bug.
//
// This guard reads the route sources rather than booting them: the response
// headers are assembled in the route, not in a shared middleware, so the shape
// of the source is the contract. It is deliberately narrow — it requires the
// destructuring and wraps only the three response builders the routes use.
//
// Mock responses are included on purpose. `AI_MOCK=1` is how the whole product
// is exercised in CI; if the mock returns before the stamp, the mock lane would
// be testing a product that never shows a quota, which is exactly the blind
// spot recorded in the Phase 3 handoff.
//
// The tree walk is `tests/unit/repo-tree.ts`, not a second copy: `facts:check`
// ratchets the number of repo walkers (`debt.repoWalkers`), and a guard that
// adds one to check another rule has already broken the first rule.
import path from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";
import { readRepo, walkRepo } from "../unit/repo-tree";

const API_ROOT = "src/app/api";

/**
 * Routes that intentionally have no per-user quota reading. Each one needs a
 * reason a reader can check, not a label: the exemption is what lets the guard
 * stay absolute everywhere else.
 */
const EXEMPT = new Map([
  [
    "session/route.ts",
    "the session door is requireSession:false, so guardRequest never sets a quota",
  ],
  [
    "parse-resume/route.ts",
    "hand-rolled formData pipeline: it never calls guardRequest, so it has no budget reading",
  ],
  ["health/route.ts", "public liveness probe: no guardRequest and no budget"],
  ["csp-report/route.ts", "204 report sink: no guardRequest and no budget"],
]);

const RESPONSE_BUILDERS = new Set(["okResponse", "mockJson", "mockTextStream"]);

function lineOf(sf: ts.SourceFile, node: ts.Node): number {
  return sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1;
}

describe("every guarded API route stamps the caller's remaining allowance", () => {
  const files = walkRepo(API_ROOT, (rel) => rel.endsWith("/route.ts")).sort();
  const relative = (file: string) => path.posix.relative(API_ROOT, file);

  it("finds the routes it claims to guard", () => {
    // A walker that silently returns [] would make every case below vacuous.
    expect(files.length, `walked ${API_ROOT}`).toBeGreaterThanOrEqual(19);
  });

  it("keeps the exemption list honest", () => {
    for (const rel of EXEMPT.keys()) {
      expect(
        files.some((f) => relative(f) === rel),
        `${rel} is exempt but no longer exists`
      ).toBe(true);
    }
  });

  for (const file of files) {
    const rel = relative(file);
    if (EXEMPT.has(rel)) continue;

    const src = readRepo(file);
    if (!src.includes("guardRequest(")) continue;

    it(`${rel}: destructures quota from the guard context`, () => {
      expect(
        src,
        `${rel} calls guardRequest but never reads ctx.quota, so its success response cannot carry the allowance`
      ).toMatch(/const \{[^}]*\bquota\b[^}]*\} = gate\.ctx/);
    });

    it(`${rel}: wraps every success and mock response`, () => {
      const sf = ts.createSourceFile(file, src, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
      const unwrapped: string[] = [];
      const visit = (node: ts.Node) => {
        if (ts.isReturnStatement(node) && node.expression && ts.isCallExpression(node.expression)) {
          const callee = node.expression.expression.getText(sf);
          if (RESPONSE_BUILDERS.has(callee)) {
            unwrapped.push(
              `${rel}:${lineOf(sf, node)} returns ${callee}(...) without applyQuotaHeaders`
            );
          }
        }
        ts.forEachChild(node, visit);
      };
      visit(sf);
      expect(
        unwrapped,
        "a success path that skips the stamp is a quota the client never sees"
      ).toEqual([]);
    });
  }
});
