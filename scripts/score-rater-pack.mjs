// score-rater-pack.mjs — Phase A1: blind-pack agreement scorer (keyless).
//
// Reads filled `rater-pack/scores/sheet-*.csv` (long format:
// rater_id,case_id,item,value) and reports, per interview dimension +
// READINESS: Fleiss quadratic-weighted kappa + Krippendorff's alpha
// (ordinal) + a worst-first disagreement table. Practice SCORE (0-100) is
// continuous — reported as mean pairwise |diff| + % within ±10, NEVER kappa.
//
// Graduation stays HUMAN (EVAL_REPORT §6): this script prints an ADVISORY
// line against κ≥0.6; replacing authored bands additionally needs anchor
// review + adjudication. Missing/blank cells are skipped (Fleiss needs ≥2
// ratings/subject; alpha uses pairable values only) — coverage is reported.
//
// Math notes:
//   Fleiss (weighted generalization for varying n_i): Po = mean_i[1 -
//     Σ_ab w_ab·n_ia·n_ib / (n_i(n_i-1))], Pe = 1 - Σ_ab w_ab·p_a·p_b,
//     κ = (Po-Pe)/(1-Pe), w_ab = ((a-b)/(k-1))².
//   Krippendorff α (ordinal): coincidences o_ck normalized per unit by
//     1/(m_u-1); δ²_ck = ((c-k)/(k-1))²; α = 1 - Do/De.
//   Hand-verified anchors live in tests/unit/score-rater-pack.test.ts.
//
// Usage: node scripts/score-rater-pack.mjs <scores-dir|.csv...>
// Exit: 0 with table; 2 when fewer than 2 raters share a rated item
// (INSUFFICIENT — not a failure); 1 on usage/IO errors.

import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

export const READINESS_LEVELS = ["needs_foundation", "developing", "interview_ready", "strongly_prepared"];
export const GRADUATION_KAPPA = 0.6;

function quadWeight(a, b, k) {
  if (k <= 1) return 0;
  const d = (a - b) / (k - 1);
  return d * d;
}

/**
 * Fleiss quadratic-weighted kappa over subjects.
 * @param ratings subjects × ratings as 0-based category indices (missing = null/undefined)
 * @param k number of ordered categories
 * @returns {kappa, subjectsUsed, subjectsTotal} (kappa NaN when degenerate)
 */
export function fleissKappaQuadratic(ratings, k) {
  const usable = ratings.filter((r) => r.filter((v) => v !== null && v !== undefined).length >= 2);
  const result = { kappa: Number.NaN, subjectsUsed: usable.length, subjectsTotal: ratings.length };
  if (usable.length === 0 || k <= 1) return result;
  let poSum = 0;
  const totals = new Array(k).fill(0);
  let totalAssignments = 0;
  for (const r of usable) {
    const counts = new Array(k).fill(0);
    for (const v of r) {
      if (v === null || v === undefined) continue;
      counts[v] += 1;
    }
    const n = counts.reduce((a, b) => a + b, 0);
    let dis = 0;
    for (let a = 0; a < k; a++) {
      totals[a] += counts[a];
      for (let b = 0; b < k; b++) dis += quadWeight(a, b, k) * counts[a] * counts[b];
    }
    totalAssignments += n;
    poSum += 1 - dis / (n * (n - 1));
  }
  const p = totals.map((t) => t / totalAssignments);
  let peDis = 0;
  for (let a = 0; a < k; a++) for (let b = 0; b < k; b++) peDis += quadWeight(a, b, k) * p[a] * p[b];
  const po = poSum / usable.length;
  const pe = 1 - peDis;
  result.kappa = pe === 1 ? Number.NaN : (po - pe) / (1 - pe);
  return result;
}

/**
 * Krippendorff's alpha (ordinal) over subjects.
 * Same input convention as fleissKappaQuadratic.
 */
export function krippendorffAlphaOrdinal(ratings, k) {
  if (k <= 1) return { alpha: Number.NaN, pairable: 0 };
  const o = Array.from({ length: k }, () => new Array(k).fill(0));
  let pairable = 0;
  for (const r of ratings) {
    const vals = r.filter((v) => v !== null && v !== undefined);
    if (vals.length < 2) continue;
    // Ordered observer pairs (i≠j), each unit normalized by 1/(m-1) so it
    // contributes exactly m pairable values. Self-pairs are EXCLUDED —
    // including them inflates the diagonal (caught by unit test 2026-09-17).
    const norm = 1 / (vals.length - 1);
    for (let i = 0; i < vals.length; i++) {
      for (let j = 0; j < vals.length; j++) {
        if (i === j) continue;
        o[vals[i]][vals[j]] += norm;
      }
    }
    pairable += vals.length;
  }
  if (pairable === 0) return { alpha: Number.NaN, pairable: 0 };
  const nMarg = o.map((row) => row.reduce((x, y) => x + y, 0));
  let dO = 0;
  for (let a = 0; a < k; a++) for (let b = 0; b < k; b++) dO += o[a][b] * quadWeight(a, b, k);
  dO /= pairable;
  let dE = 0;
  for (let a = 0; a < k; a++) for (let b = 0; b < k; b++) dE += nMarg[a] * nMarg[b] * quadWeight(a, b, k);
  dE /= pairable * (pairable - 1);
  if (dE === 0) return { alpha: dO === 0 ? 1 : Number.NaN, pairable };
  return { alpha: 1 - dO / dE, pairable };
}

/** Parse one long-format sheet into rows {rater, caseId, item, value}. */
export function parseScoreSheet(text) {
  const rows = [];
  const lines = text.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    if (i === 0 && /^rater_id\s*,/i.test(line)) continue; // header
    const parts = line.split(",");
    if (parts.length < 4) continue;
    const [rater, caseId, item, ...rest] = parts.map((s) => s.trim());
    rows.push({ rater, caseId, item, value: rest.join(",") });
  }
  return rows;
}

function toDimIndex(value) {
  const n = Number.parseInt(String(value).trim(), 10);
  return Number.isInteger(n) && n >= 1 && n <= 5 ? n - 1 : null;
}

function toReadinessIndex(value) {
  const idx = READINESS_LEVELS.indexOf(String(value).trim().toLowerCase());
  return idx >= 0 ? idx : null;
}

/**
 * Score a set of sheet texts. Returns a full result object (no printing).
 * Dimension items: every item except READINESS/SCORE (generic 1-5 ordinal).
 */
export function scoreSheets(sheetTexts) {
  const byKey = new Map(); // `${caseId}‖${item}` -> Map(rater -> raw value)
  const raters = new Set();
  let nInvalid = 0;
  for (const text of sheetTexts) {
    for (const row of parseScoreSheet(text)) {
      if (!row.value) continue; // blank = missing (skipped, counted via coverage)
      raters.add(row.rater);
      const key = `${row.caseId}‖${row.item}`;
      if (!byKey.has(key)) byKey.set(key, new Map());
      byKey.get(key).set(row.rater, row.value);
    }
  }

  const dimensions = [];
  let readiness = null;
  const practiceScores = [];
  const disagreements = [];
  // Group ordinal items by ITEM across cases: subjects = cases (graduation
  // is κ on the 12 interview cases, not per-cell).
  const itemGroups = new Map(); // item -> { k, toIdx, cases: [{caseId, values}] }

  const cellAgreement = (idxs, k) => {
    if (idxs.length < 2) return Number.NaN;
    let s = 0;
    let p = 0;
    for (let i = 0; i < idxs.length; i++) {
      for (let j = i + 1; j < idxs.length; j++) {
        s += 1 - Math.abs(idxs[i] - idxs[j]) / (k - 1);
        p += 1;
      }
    }
    return s / p;
  };

  for (const [key, perRater] of byKey) {
    const [caseId, item] = key.split("‖");
    if (item === "SCORE" && caseId.startsWith("practice-")) {
      const vals = [...perRater.values()].map((v) => Number.parseFloat(v)).filter((n) => Number.isFinite(n) && n >= 0 && n <= 100);
      nInvalid += perRater.size - vals.length;
      if (vals.length >= 2) {
        let sum = 0;
        let pairs = 0;
        let within10 = 0;
        for (let i = 0; i < vals.length; i++) {
          for (let j = i + 1; j < vals.length; j++) {
            const d = Math.abs(vals[i] - vals[j]);
            sum += d;
            pairs += 1;
            if (d <= 10) within10 += 1;
          }
        }
        practiceScores.push({ caseId, n: vals.length, meanAbsDiff: sum / pairs, within10: within10 / pairs });
      }
      continue;
    }
    const isReadiness = item === "READINESS";
    if (!itemGroups.has(item)) {
      itemGroups.set(item, { k: isReadiness ? READINESS_LEVELS.length : 5, toIdx: isReadiness ? toReadinessIndex : toDimIndex, cases: [] });
    }
    const g = itemGroups.get(item);
    const idxs = [...perRater.values()].map((v) => {
      const idx = g.toIdx(v);
      if (idx === null) nInvalid += 1;
      return idx;
    });
    g.cases.push({ caseId, values: idxs });
    disagreements.push({ caseId, item, k: g.k, raters: idxs.filter((v) => v !== null).length, agreement: cellAgreement(idxs.filter((v) => v !== null), g.k) });
  }

  for (const [item, g] of itemGroups) {
    const ratings = g.cases.map((c) => c.values);
    const fleiss = fleissKappaQuadratic(ratings, g.k);
    const alpha = krippendorffAlphaOrdinal(ratings, g.k);
    const entry = { item, k: g.k, kappa: fleiss.kappa, alpha: alpha.alpha, subjectsUsed: fleiss.subjectsUsed, subjectsTotal: fleiss.subjectsTotal };
    if (item === "READINESS") readiness = entry;
    else dimensions.push(entry);
  }

  disagreements.sort((a, b) => (a.agreement || 0) - (b.agreement || 0));
  const dimKappas = dimensions.map((d) => d.kappa).filter((v) => Number.isFinite(v));
  const meanKappa = dimKappas.length ? dimKappas.reduce((a, b) => a + b, 0) / dimKappas.length : Number.NaN;

  return {
    raters: [...raters].sort(),
    nRaters: raters.size,
    nInvalid,
    dimensions,
    readiness,
    meanDimKappa: meanKappa,
    graduationAdvisory:
      raters.size < 2
        ? "INSUFFICIENT (need 2+ raters)"
        : Number.isFinite(meanKappa) && meanKappa >= GRADUATION_KAPPA
          ? `ADVISORY PASS (mean κ=${meanKappa.toFixed(3)} ≥ ${GRADUATION_KAPPA}) — human adjudication still required`
          : `ADVISORY HOLD (mean κ=${Number.isFinite(meanKappa) ? meanKappa.toFixed(3) : "n/a"} < ${GRADUATION_KAPPA}) — clarify anchors, re-rate`,
    practiceScores,
    disagreements: disagreements.slice(0, 10),
  };
}

function fmt(v, digits = 3) {
  return Number.isFinite(v) ? v.toFixed(digits) : "n/a";
}

function main() {
  const args = process.argv.slice(2);
  if (args.length === 0 || args.includes("-h") || args.includes("--help")) {
    console.error("usage: node scripts/score-rater-pack.mjs <scores-dir|sheet.csv...>");
    process.exit(1);
  }
  const files = [];
  for (const a of args) {
    try {
      const st = fs.statSync(a);
      if (st.isDirectory()) {
        for (const f of fs.readdirSync(a)) {
          if (f.endsWith(".csv")) files.push(path.join(a, f));
        }
      } else {
        files.push(a);
      }
    } catch (err) {
      console.error(`[rater-score] cannot read ${a}: ${String(err && err.message ? err.message : err)}`);
      process.exit(1);
    }
  }
  if (files.length === 0) {
    console.error("[rater-score] no CSV sheets found");
    process.exit(1);
  }
  const result = scoreSheets(files.map((f) => fs.readFileSync(f, "utf8")));
  if (result.nRaters < 2) {
    console.log(`[rater-score] INSUFFICIENT: ${result.nRaters} rater(s) — need 2+ overlapping sheets`);
    process.exit(2);
  }
  console.log(`[rater-score] raters=${result.nRaters} invalid=${result.nInvalid}`);
  console.log("[rater-score] interview items, subjects=cases (κ Fleiss-quad, α Krippendorff-ord):");
  for (const d of result.dimensions) {
    console.log(`  ${d.item}: κ=${fmt(d.kappa)} α=${fmt(d.alpha)} subjects=${d.subjectsUsed}/${d.subjectsTotal}`);
  }
  if (result.readiness) {
    const r = result.readiness;
    console.log(`[rater-score] READINESS: κ=${fmt(r.kappa)} α=${fmt(r.alpha)} subjects=${r.subjectsUsed}/${r.subjectsTotal}`);
  }
  console.log(`[rater-score] ${result.graduationAdvisory}`);
  if (result.practiceScores.length) {
    console.log("[rater-score] practice SCORE (descriptive, never kappa):");
    for (const p of result.practiceScores) {
      console.log(`  ${p.caseId}: n=${p.n} mean|Δ|=${fmt(p.meanAbsDiff, 1)} within±10=${(p.within10 * 100).toFixed(0)}%`);
    }
  }
  console.log("[rater-score] worst-first cell disagreements:");
  for (const d of result.disagreements) {
    console.log(`  agree=${fmt(d.agreement)} ${d.caseId} ${d.item} (raters=${d.raters})`);
  }
}

const invokedAsMain =
  typeof process.argv[1] === "string" && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url;
if (invokedAsMain) main();
