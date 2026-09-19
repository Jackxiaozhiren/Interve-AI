// B2 query-discipline guardrail (static, no live DB).
//
// All Supabase reads funnel through src/lib/api-client.ts. This test pins
// the current select('*') inventory: adding a new one fails until its row
// below carries a justification. Column whitelisting was evaluated per site
// (2026-09-19) and DECLINED where the reader needs full rows — trimming
// would trade silent undefineds (toCamelCase casts hide missing columns)
// for bytes, with no live DB to verify savings. Revisit with
// pg_stat_statements + transfer numbers, never blind.
//
// N+1 audit (same date): CLEAN — every list path is one query + in-memory
// join (dashboard aggregates, achievements+definitions, telemetry windows).
// No per-row follow-up queries exist in src/.
// FK audit: schema has zero REFERENCES (app-joined by id); owner/status/
// created_at/category/endpoint/timestamp/code indexes already in 001/002.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

const ROOT = new URL("../../", import.meta.url);
const src = readFileSync(new URL("src/lib/api-client.ts", ROOT), "utf8");

// 13 occurrences across 12 site patterns (interviews orderBy asc+desc share
// one pattern). The COUNT pin is binding; the patterns document the why.
const EXPECTED_STAR_COUNT = 13;
const KNOWN_STAR_SELECTS = [
  // interviews.get(id) — single-row detail (modal/dossier/replay need full row).
  "interviews').select('*').eq('id', id).single()",
  // interviews list (orderBy asc/desc) — dashboard aggregates read
  // status/createdAt/title/scores/radar/readiness across ALL rows; the
  // detail modal reuses the same objects (resumeText/jobDescription/
  // councilDebate/timeline for dossier). Trimming needs a lazy-get
  // refactor of the modal open path — tracked, not done blind.
  "interviews').select('*').order(snakeField",
  // interviews where().sortBy — same full-row readers as the list path.
  "interviews').select('*').eq(snakeField, value)",
  // evaluations where().first — recruiter lane reads full evaluation.
  "evaluations').select('*').eq(snakeField, value)",
  // practice_sessions list + where — report/replay detail needs full rows.
  "practice_sessions').select('*').order('created_at'",
  "practice_sessions').select('*').eq(snakeField, value)",
  // telemetry list — already paged (D3 limit); columns are all scalars.
  "telemetry').select('*').order(snakeField",
  // achievements — narrow table (code/unlockedAt), single + lists.
  "achievements').select('*').eq(snakeField, value)",
  "achievements').select('*').order(snakeField",
  "achievements').select('*');",
  // orama_index.get(id) — single-row hub fetch, needs data blob.
  "orama_index').select('*').eq('id', id)",
];

describe("select('*') inventory pin (B2)", () => {
  it("contains exactly the justified sites (additions must justify here)", () => {
    const hits = src.match(/\.select\('\*'\)/g) ?? [];
    expect(
      hits.length,
      `select('*') count changed: got ${hits.length}, want ${EXPECTED_STAR_COUNT}. ` +
        `If you added one, justify it in KNOWN_STAR_SELECTS with reader evidence.`
    ).toBe(EXPECTED_STAR_COUNT);
    for (const site of KNOWN_STAR_SELECTS) {
      expect(src, `justified site missing: ${site}`).toContain(site);
    }
  });

  it("telemetry list stays paged (D3 bound, no uncapped scan)", () => {
    expect(src).toMatch(/telemetry'\)\.select\('\*'\)\.order\(snakeField/);
    // The D3 limit() chain is asserted behaviorally in api-client-limit.test.ts.
  });
});
