/**
 * The anon bridge: keep the claim and the evidence at the same strength.
 *
 * `docs/SECURITY.md` said migration 006 "closed the anon-readable content
 * tables" while `006_close_anon_bridge_content_tables.sql`'s own header called
 * itself a draft. For six weeks no path in the repo could settle it — the
 * publishable key reads through PostgREST, which applies RLS but never reports
 * it — and the probe that could be run was self-ambiguous: anon reads return 0
 * rows on all seven tables, which is
 * what a closed bridge looks like *and* what a database with no ownerless rows
 * looks like.
 *
 * So this gate does two things rather than pretending to do one. It pins the
 * expected policy set by computing it from the migrations (prose is not the
 * source of truth), and it refuses to let the documentation claim more than
 * `docs/audit/anon-bridge-evidence.json` proves. When someone pastes the
 * `pg_policies` dump from `scripts/sql/verify-anon-bridge.sql` into that file and
 * flips its status, the same test becomes the check that closes the item — set
 * equality against the derived policy list, not a sentence saying it worked.
 */
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  LEGACY_BRIDGE_POLICIES,
  anonBridgeTables,
  classifyBridge,
  derivePolicyState,
  isAnonBridge,
  policyKey,
} from "../../scripts/derive-policy-state.mjs";

const REPO = resolve(__dirname, "../..");
const EVIDENCE = "docs/audit/anon-bridge-evidence.json";
const DOC = "docs/SECURITY.md";

/** The five tables 006 closes, and the two it keeps bridged on purpose. */
const CLOSED_TABLES = ["interviews", "evaluations", "practice_sessions", "assessments", "orama_index"];
const BRIDGE_TABLES = ["telemetry", "achievements"];

const migrationDir = "supabase/migrations";
const migrationFiles = readdirSync(resolve(REPO, migrationDir))
  .filter((f) => f.endsWith(".sql"))
  .sort();
const state = derivePolicyState(
  migrationFiles.map((f) => ({ name: f, sql: readFileSync(resolve(REPO, migrationDir, f), "utf8") }))
);
const bridge = classifyBridge(state, CLOSED_TABLES, BRIDGE_TABLES);

const evidence = JSON.parse(readFileSync(resolve(REPO, EVIDENCE), "utf8")) as {
  status: string;
  recheckBy: string | null;
  projectRef: string;
  pgPolicies: {
    collectedAt: string | null;
    rows: { table: string; policy: string; roles?: string; cmd?: string; qual?: string }[];
  };
  anonProbe: { measuredAt: string; tables: Record<string, { http: number; rows: number }> };
};

const doc = readFileSync(resolve(REPO, DOC), "utf8");

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

describe("the expected policy set is derived, not quoted", () => {
  it("reads every migration it claims to (instrument sanity)", () => {
    expect(migrationFiles.length, "no migrations found — the derivation would be vacuous").toBeGreaterThanOrEqual(7);
    expect(state.tables.size).toBeGreaterThanOrEqual(7);
  });

  it("follows every policy statement in the migrations", () => {
    // The derivation refuses to guess: a policy in a shape it cannot parse is
    // reported, and a non-empty list means the expected set below is a subset of
    // reality rather than reality.
    expect(state.unparsed, `unparsed policy statements: ${state.unparsed.join(" | ")}`).toEqual([]);
  });

  it("lands on the arithmetic 006 claims for itself", () => {
    // 7 tables x 4 per-operation owner policies + 2 bridge tables x 4 legacy
    // policies. 006's header says "five tables x four operations = 20 dropped";
    // that is the half that must be *absent*, asserted right here.
    expect(state.policies.size).toBe(36);
    expect(bridge.closed.filter((b) => b.present)).toEqual([]);
    expect(bridge.closed.length).toBe(20);
    expect(bridge.open.filter((b) => b.present).length).toBe(8);
    expect(new Set(bridge.open.map((b) => b.table))).toEqual(new Set(BRIDGE_TABLES));
  });

  it("never leaves a content table readable by anon in the derived set", () => {
    const leaked = CLOSED_TABLES.filter((t) =>
      LEGACY_BRIDGE_POLICIES.some((p) => state.policies.has(policyKey(t, p)))
    );
    expect(leaked).toEqual([]);
  });
});

describe("the documentation cannot outpace the evidence", () => {
  it("carries the marker the evidence state requires", () => {
    // Three states, because two were not enough: a dump can settle the question
    // and the answer can be "the hole is still open". Forcing that into
    // `unproven` would let the document imply ignorance where the repo holds
    // evidence.
    const marker = /anon-bridge:\s*`?(unproven|proven|open)`?/.exec(doc);
    expect(marker, `${DOC} carries no anon-bridge: status`).not.toBeNull();
    const expected =
      evidence.status === "PROVEN" ? "proven" : evidence.pgPolicies.rows.length > 0 ? "open" : "unproven";
    expect(marker![1], `evidence says ${evidence.status}, doc says ${marker![1]}`).toBe(expected);
  });

  it("says the kind of thing about 006 the evidence state allows", () => {
    const sentences = doc
      .split(/(?<=[.!?)])\s+|\n/)
      .map((s) => s.trim())
      .filter((s) => /\b006\b/.test(s));
    expect(sentences.length, "no sentence mentions 006 — the item vanished from the doc").toBeGreaterThan(0);

    if (evidence.status === "PENDING") {
      const unhedged = sentences.filter(
        (s) => !/unproven|PENDING|not applied|never applied|needs .*pg_policies|asserted by the migration files only/i.test(s)
      );
      expect(unhedged, `asserted as done while unproven: ${unhedged.join(" || ")}`).toEqual([]);
    } else if (evidence.status === "OPEN") {
      // A hedge is now the wrong shape of claim: the catalog has been read, and it
      // says the hole is there. "unproven" would understate a finding.
      const statesIt = sentences.filter((s) => /not applied|never applied|bridge is live|still open/i.test(s));
      expect(statesIt.length, "the dump shows the bridge live on the content tables; no 006 sentence says so").toBeGreaterThan(0);
    }
  });

  it("keeps a pending artifact genuinely empty rather than half-filled", () => {
    if (evidence.status !== "PENDING") return;
    expect(evidence.pgPolicies.rows, "rows collected but status still PENDING").toEqual([]);
    expect(evidence.pgPolicies.collectedAt).toBeNull();
    expect(evidence.recheckBy).toBeNull();
  });

  it("records the probe over every content table, not a convenient subset", () => {
    const probed = Object.keys(evidence.anonProbe.tables).sort();
    const expected = [...CLOSED_TABLES, ...BRIDGE_TABLES].sort();
    expect(probed).toEqual(expected);
    expect(ISO_DATE.test(evidence.anonProbe.measuredAt), evidence.anonProbe.measuredAt).toBe(true);
    // The probe is only worth recording because it is ambiguous. If a future run
    // returns rows, that is a live leak and the gate must say so plainly.
    const leaking = probed.filter((t) => evidence.anonProbe.tables[t]!.rows > 0);
    expect(leaking, `anon can read ownerless rows in ${leaking.join(", ")} — the bridge is open in production`).toEqual([]);
  });

  it("holds the live dump the checks below read", () => {
    // Collected 2026-10-12 by the read-only SELECT in scripts/sql/verify-anon-bridge.sql.
    // This arm exists so the comparison after it cannot go vacuous: the guard used
    // to gate the whole comparison on `status === "PROVEN"`, so a dump recorded
    // under any other label was read by nothing and the suite stayed green on the
    // strongest evidence the repo owns.
    expect(evidence.pgPolicies.rows.length, "no dump in the artifact — the comparison below checks nothing").toBeGreaterThan(0);
    expect(ISO_DATE.test(evidence.pgPolicies.collectedAt ?? ""), "collectedAt must be a date").toBe(true);
  });

  it("evaluates the dump it holds, whatever label the artifact carries", () => {
    const bridged = anonBridgeTables(evidence.pgPolicies.rows, CLOSED_TABLES);
    if (bridged.length > 0) {
      expect(evidence.status, `the catalog still bridges ${bridged.join(", ")} but the artifact says ${evidence.status}`).toBe("OPEN");
      expect(evidence.recheckBy, "an open finding with no re-check condition is a known hole nobody owns").toBeTruthy();
    } else {
      const live = evidence.pgPolicies.rows.map((r) => policyKey(r.table, r.policy)).sort();
      const derived = [...state.policies.keys()].sort();
      expect(evidence.status, "the dump shows a closed bridge; the artifact must say PROVEN").toBe("PROVEN");
      expect(new Date(evidence.recheckBy ?? ""), "PROVEN needs a future recheckBy").toBeInstanceOf(Date);
      expect(live, `${derived.length} policies derived from the migrations, ${live.length} in the catalog`).toEqual(derived);
    }
  });

  it("names the production project the proof came from", () => {
    expect(evidence.projectRef, "the artifact must say which project was inspected").toMatch(/^[a-z0-9]{15,25}$/);
  });

  it("detects the bridge by what it grants, not by the four names 003 used", () => {
    // The shape production actually has: one policy per table, FOR ALL TO anon,
    // USING (user_id IS NULL). Keyed on names, every check in this repo — the
    // deriver, classifyBridge, and 006's own DROP list — reported no bridge at all
    // on a catalog holding five on content tables.
    const row = { table: "interviews", policy: "Legacy anon unowned access", roles: "{anon}", cmd: "ALL", qual: "(user_id IS NULL)" };
    expect(isAnonBridge(row), "a cmd=ALL anon grant on ownerless rows is the same hole").toBe(true);
    // Self-inverting on purpose: if the name list is ever widened to cover this
    // shape, the predicate becomes the redundant copy and someone must decide
    // which one is the source of truth — rather than both drifting.
    expect(LEGACY_BRIDGE_POLICIES.includes(row.policy), "name list now overlaps the predicate; delete the weaker detector").toBe(false);
    expect(classifyBridge({ policies: new Map([[policyKey(row.table, row.policy), row.policy]]) }, CLOSED_TABLES, BRIDGE_TABLES).closed.filter((b) => b.present)).toEqual([]);
  });

  it("006 drops by predicate and refuses to succeed with the hole open", () => {
    const drop = state.predicateDrops.find((p: { file: string }) => p.file.startsWith("006_"));
    if (!drop) {
      throw new Error("006 no longer contains a predicate drop — a name list alone saw no bridge on the catalog this repo actually deploys to");
    }
    for (const table of CLOSED_TABLES) {
      expect(drop.predicate, `the drop predicate does not name ${table}`).toContain(`'${table}'`);
    }
    expect(drop.predicate, "the drop predicate must key on the anon role").toMatch(/roles\s+@>\s*ARRAY\['anon'\]/i);
    expect(drop.predicate, "and on the ownerless-row grant, not on a policy name").toMatch(/user_id IS NULL/i);
    expect(drop.residualPredicate, "006 must count what is left and raise, not assume").toMatch(/roles\s+@>\s*ARRAY\['anon'\]/i);
    for (const table of CLOSED_TABLES) {
      expect(drop.residualPredicate, `the residual check does not cover ${table}`).toContain(`'${table}'`);
    }
  });
});
