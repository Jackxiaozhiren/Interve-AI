/**
 * Fairness is a measurement, not a claim.
 *
 * The report can tell a candidate "your readiness level is developing" only if
 * it can also answer the obvious next question: *would the same answers have
 * scored differently if my name, my pronouns or my employer had been
 * different?* That answer already exists as an offline audit — the keyed
 * fairness suite in `evals/live.eval.test.ts` runs each pair twice and measures
 * the drift — but the app consumed none of it (the handoff records B19: rc 1,
 * zero matches). This module turns the audit artifact into a reading the card
 * can render, and refuses to invent one when nothing has been measured.
 *
 * Two properties are deliberate:
 *
 *   - **No measurement is not zero.** A missing or empty artifact returns
 *     `null`, never `{ rate: 0 }`. "We did not measure" and "we measured and
 *     found no flips" are different statements about the product, and only the
 *     second one is reassuring.
 *   - **The sample size travels with the rate.** Three pairs cannot support a
 *     percentage the way three hundred can, so the reading carries `runs` and
 *     every cell carries its own `n`. The card says both.
 */

export interface FairnessCell {
  /** Stable key, e.g. `name`, `pronoun`, `org-type`, `gap-framing`. */
  attribute: string;
  /** What the candidate sees, in Simplified Chinese. */
  label: string;
  /** How many of the paired evaluations changed their verdict. */
  flips: number;
  /** How many paired evaluations this cell is based on. */
  n: number;
}

export interface FairnessAudit {
  version: string;
  /** ISO timestamp of the audit run; null until one has been run. */
  measuredAt: string | null;
  model: string | null;
  runs: number;
  cells: FairnessCell[];
}

export interface FairnessCellReading extends FairnessCell {
  rate: number;
}

export interface FairnessReading {
  measuredAt: string;
  model: string;
  /** Total verdict flips across every cell. */
  flips: number;
  /** Total paired evaluations. */
  runs: number;
  /** `flips / runs`, in [0, 1]. */
  rate: number;
  cells: FairnessCellReading[];
}

const isNonNegativeInt = (value: unknown): value is number =>
  typeof value === "number" && Number.isInteger(value) && value >= 0;

/**
 * Validate the artifact and compute the reading.
 *
 * Returns `null` when there is nothing honest to show: the artifact is not an
 * object, a cell is malformed, or every cell has `n === 0`. A malformed cell is
 * treated as no measurement rather than as zero — silently dropping it would
 * report a smaller, cleaner-looking sample than the audit actually took.
 */
export function summarizeFairness(audit: unknown): FairnessReading | null {
  if (!audit || typeof audit !== "object") return null;
  const a = audit as Partial<FairnessAudit>;
  if (typeof a.measuredAt !== "string" || a.measuredAt.trim() === "") return null;
  if (typeof a.model !== "string" || a.model.trim() === "") return null;
  if (!Array.isArray(a.cells)) return null;

  const cells: FairnessCellReading[] = [];
  for (const raw of a.cells) {
    if (!raw || typeof raw !== "object") return null;
    const cell = raw as Partial<FairnessCell>;
    if (typeof cell.attribute !== "string" || cell.attribute.trim() === "") return null;
    if (typeof cell.label !== "string" || cell.label.trim() === "") return null;
    if (!isNonNegativeInt(cell.flips) || !isNonNegativeInt(cell.n)) return null;
    if (cell.flips > cell.n) return null;
    if (cell.n === 0) continue;
    cells.push({
      attribute: cell.attribute,
      label: cell.label,
      flips: cell.flips,
      n: cell.n,
      rate: cell.flips / cell.n,
    });
  }

  const runs = cells.reduce((sum, cell) => sum + cell.n, 0);
  if (runs === 0) return null;
  const flips = cells.reduce((sum, cell) => sum + cell.flips, 0);

  return {
    measuredAt: a.measuredAt,
    model: a.model,
    flips,
    runs,
    rate: flips / runs,
    cells,
  };
}

/** `0.3333` → `33%`; a rate is never rounded up into a scarier number. */
export function formatRate(rate: number): string {
  const pct = Math.floor(rate * 1000) / 10;
  return `${Number.isInteger(pct) ? pct : pct.toFixed(1)}%`;
}

/** `2026-11-11T10:00:00Z` → `2026-11-11`; never a locale the reader may not share. */
export function formatMeasuredAt(iso: string): string {
  const match = /^(\d{4}-\d{2}-\d{2})/.exec(iso);
  return match ? match[1] : iso;
}
