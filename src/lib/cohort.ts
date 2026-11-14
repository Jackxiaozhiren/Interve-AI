/**
 * Same-track benchmarks, and the floor that keeps them from being a row.
 *
 * Owner decision (2026-11-13, option A): a cohort is the same role direction
 * and the same rubric over a rolling window — not a school, not an employer.
 * No identity attribute is collected, so there is nothing new to consent to.
 *
 * The important rule lives here in a form the UI cannot bypass:
 *
 *   - **The floor is a constant, not an argument.** A `minCell` parameter would
 *     let any caller pass 1 and read a "distribution" of one person, which is
 *     not a distribution. `suppressSmallCells` is the only way in, and it has no
 *     threshold argument.
 *   - **Absence is not zero.** An empty result is not "everyone scored 0"; the
 *     card says the sample is too small, which is a different statement.
 */

/** Hard floor. Matches `HAVING count(*) >= 10` inside migration 009. */
export const COHORT_MIN_CELL = 10;

/** Rolling window, fixed in the SQL as well so a caller cannot widen it. */
export const COHORT_WINDOW_DAYS = 180;

export interface CohortCell {
  dimensionId: string;
  /** Reports behind this cell. Always >= COHORT_MIN_CELL after suppression. */
  n: number;
  p25: number;
  p50: number;
  p75: number;
}

/** Whether a cell may be shown at all. */
export function isPublishableCell(n: number): boolean {
  return Number.isFinite(n) && n >= COHORT_MIN_CELL;
}

/**
 * Validate and filter what the database returned.
 *
 * Malformed rows are dropped rather than coerced: a cell with a missing
 * percentile cannot be rendered honestly, and inventing a 0 would read as "the
 * cohort scored zero".
 */
export function suppressSmallCells(rows: unknown): CohortCell[] {
  if (!Array.isArray(rows)) return [];
  const out: CohortCell[] = [];
  for (const raw of rows) {
    if (!raw || typeof raw !== "object") continue;
    const r = raw as Record<string, unknown>;
    const dimensionId = r.dimension_id;
    const n = Number(r.n);
    const p25 = Number(r.p25);
    const p50 = Number(r.p50);
    const p75 = Number(r.p75);
    if (typeof dimensionId !== "string" || dimensionId.trim() === "") continue;
    if (![n, p25, p50, p75].every((v) => Number.isFinite(v))) continue;
    if (!isPublishableCell(n)) continue;
    if (p25 > p50 || p50 > p75) continue;
    out.push({ dimensionId, n: Math.floor(n), p25, p50, p75 });
  }
  return out;
}

export type CohortPosition = "below" | "near" | "above";

/**
 * Where one score sits relative to the cohort's interquartile range.
 *
 * Deliberately coarse: three words a reader can act on, not a percentile that
 * implies a precision ten reports cannot support.
 */
export function positionOf(score: number, cell: CohortCell): CohortPosition {
  if (score < cell.p25) return "below";
  if (score > cell.p75) return "above";
  return "near";
}

export const POSITION_LABEL: Record<CohortPosition, string> = {
  below: "低于同类多数",
  near: "与同类相近",
  above: "高于同类多数",
};
