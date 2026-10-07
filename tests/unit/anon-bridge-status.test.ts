/**
 * The anon bridge: keep the claim and the evidence at the same strength.
 *
 * `docs/SECURITY.md` said migration 006 "closed the anon-readable content
 * tables". `006_close_anon_bridge_content_tables.sql`'s own header says
 * "STATUS: DRAFT — NOT APPLIED ANYWHERE". A keyless local path cannot reach the
 * live catalog to settle it — the publishable key reads through PostgREST, which
 * applies RLS but never reports it — and the probe that can be run is
 * self-ambiguous: anon reads return 0 rows on all seven tables today, which is
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
  classifyBridge,
  derivePolicyState,
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
  pgPolicies: { collectedAt: string | null; rows: { table: string; policy: string }[] };
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
    const marker = /anon-bridge:\s*`?(unproven|proven)`?/.exec(doc);
    expect(marker, `${DOC} carries no anon-bridge: status`).not.toBeNull();
    const expected = evidence.status === "PROVEN" ? "proven" : "unproven";
    expect(marker![1], `evidence says ${evidence.status}, doc says ${marker![1]}`).toBe(expected);
  });

  it("hedges every sentence that mentions 006 while the proof is pending", () => {
    if (evidence.status === "PROVEN") return;
    const sentences = doc
      .split(/(?<=[.!?)])\s+|\n/)
      .map((s) => s.trim())
      .filter((s) => /\b006\b/.test(s));
    expect(sentences.length, "no sentence mentions 006 — the item vanished from the doc").toBeGreaterThan(0);
    const unhedged = sentences.filter(
      (s) => !/unproven|PENDING|not applied|never applied|needs .*pg_policies|asserted by the migration files only/i.test(s)
    );
    expect(unhedged, `asserted as done while unproven: ${unhedged.join(" || ")}`).toEqual([]);
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

  it("checks the dump against the derived set once it is pasted in", () => {
    if (evidence.status !== "PROVEN") return;
    const live = evidence.pgPolicies.rows
      .map((r) => policyKey(r.table, r.policy))
      .sort();
    const derived = [...state.policies.keys()].sort();
    expect(ISO_DATE.test(evidence.pgPolicies.collectedAt ?? ""), "collectedAt must be a date").toBe(true);
    expect(evidence.recheckBy && new Date(evidence.recheckBy) > new Date(), "PROVEN needs a future recheckBy").toBe(true);
    expect(live, `${derived.length - live.length} expected policies missing from the live catalog`).toEqual(derived);
  });

  it("names the production project the proof came from", () => {
    expect(evidence.projectRef, "the artifact must say which project was inspected").toMatch(/^[a-z0-9]{15,25}$/);
  });
});
