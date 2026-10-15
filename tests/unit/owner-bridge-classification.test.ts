/**
 * Every table whose rows can be read without an owner must be classified as
 * either "never write ownerless" or "ownerless is accepted, because of what it
 * holds".
 *
 * The first half of that sentence comes from the migration, not from a list here:
 * `003_per_operation_policies.sql` grants each table a `Legacy anon * unowned`
 * policy whose predicate is `user_id IS NULL`, so a row written without an owner
 * is readable by every holder of the publishable key. Which tables have that
 * bridge is therefore a fact about the deployed schema, and the code's
 * `OWNER_REQUIRED_TABLES` is a judgement about it.
 *
 * The two sets did not match, and the difference was silent. `telemetry` and
 * `achievements` are bridged but not protected: the client writes them
 * ownerless when there is no Supabase session, which is the demo path — and
 * `tests/unit/owner-binding.test.ts` deliberately pins that behaviour, so it is a
 * reviewed trade and not an oversight. What was missing is the review's scope: a
 * hand-maintained list has no way to notice that the sixth bridged table arrived,
 * or that a table accepted as "usage metadata" grew a column that carries
 * candidate content.
 *
 * So the three predicates below are:
 *   1. the bridged set equals OWNER_REQUIRED_TABLES ∪ LOW_SENSITIVITY — a new
 *      bridged table forces a decision, in one direction or the other;
 *   2. each LOW_SENSITIVITY table's accepted payload is listed field by field and
 *      compared to the row interface in `src/lib/db.ts`, so widening that row
 *      type reddens this file rather than quietly expanding what "not content"
 *      covers;
 *   3. both sets are non-trivial, because an empty enumeration satisfies any
 *      equality.
 *
 * Witnesses: OBR1 drops a table from the protected set, OBR2 adds a
 * candidate-content field to an accepted row type. Both must go red.
 */
import { readFileSync } from "node:fs";
import ts from "typescript";
import { describe, expect, it } from "vitest";
import { OWNER_REQUIRED_TABLES } from "../../src/lib/api-client";

const MIGRATION = "supabase/migrations/003_per_operation_policies.sql";
const ROW_TYPES = "src/lib/db.ts";

const read = (rel: string) =>
  readFileSync(new URL(`../../${rel}`, import.meta.url), "utf8");

/** Tables 003 lets the anonymous role read/write while `user_id IS NULL`. */
function bridgedTables(): string[] {
  const sql = read(MIGRATION);
  return [
    ...new Set(
      [...sql.matchAll(/CREATE POLICY "Legacy anon [a-z ]*unowned" ON (\w+)/g)].map((m) => m[1])
    ),
  ].sort();
}

/** Interface name -> its declared member names, from the parse tree. */
function interfaceFields(name: string): string[] {
  const source = ts.createSourceFile(
    ROW_TYPES,
    read(ROW_TYPES),
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS
  );
  const out: string[] = [];
  const visit = (node: ts.Node) => {
    if (ts.isInterfaceDeclaration(node) && node.name.text === name) {
      for (const member of node.members) {
        if (ts.isPropertySignature(member) && member.name) out.push(member.name.getText(source).replace(/\?$/, ""));
      }
    }
    node.forEachChild(visit);
  };
  visit(source);
  return out;
}

/**
 * Bridged, and still written ownerless by design. `because` is the argument a
 * reviewer is meant to re-check; `fields` is what the argument currently covers.
 */
const LOW_SENSITIVITY: Record<string, { because: string; fields: string[] }> = {
  telemetry: {
    because:
      "per-request latency/status/error strings from the browser; no candidate answer, resume or transcript text",
    fields: ["id", "endpoint", "latencyMs", "status", "errorMessage", "timestamp"],
  },
  achievements: {
    because: "badge code/title/icon/unlockedAt derived locally; the title text is app-authored, not candidate-authored",
    fields: ["id", "code", "title", "description", "icon", "unlockedAt"],
  },
};

describe("ownerless writes are classified against the actual anon bridge", () => {
  const bridged = bridgedTables();

  it("reads the bridge from the migration, so the comparison below is not vacuous", () => {
    expect(bridged.length, `${MIGRATION} yielded no bridged tables — did the policy text change?`).toBeGreaterThanOrEqual(7);
    expect(OWNER_REQUIRED_TABLES.size).toBeGreaterThanOrEqual(5);
    expect(Object.keys(LOW_SENSITIVITY).length).toBeGreaterThanOrEqual(1);
  });

  it("classifies every bridged table as owner-required or accepted-ownerless", () => {
    const classified = [...OWNER_REQUIRED_TABLES, ...Object.keys(LOW_SENSITIVITY)].sort();
    expect(
      classified,
      "a table that the anonymous role can read by `user_id IS NULL` is either newly added or " +
        "was dropped from one of the two lists without a decision"
    ).toEqual(bridged);
  });

  for (const [table, claim] of Object.entries(LOW_SENSITIVITY)) {
    it(`keeps ${table}'s accepted-ownerless payload exactly as broad as the reason says`, () => {
      const interfaceName = table === "telemetry" ? "TelemetryEvent" : "Achievement";
      const actual = interfaceFields(interfaceName).sort();
      expect(
        actual,
        `${interfaceName} in ${ROW_TYPES} no longer matches what this file accepts as not-candidate ` +
          `content (${claim.because}); either widen OWNER_REQUIRED_TABLES or update the accepted ` +
          "field list deliberately"
      ).toEqual([...claim.fields].sort());
    });
  }
});
