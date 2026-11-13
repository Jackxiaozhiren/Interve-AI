/**
 * The floor that keeps a "distribution" from being a row.
 *
 * Owner decision (2026-11-13, option A): a cohort is the same role direction
 * and the same rubric over 180 days — no school, no employer, no identity
 * attribute. The whole privacy claim rests on one number (10) and one property
 * (it cannot be lowered by a caller). Both are pinned here, in the SQL and in
 * the filter the UI uses, because either one alone would be a single place to
 * get wrong.
 */
import { describe, expect, it } from "vitest";
import { readRepo } from "./repo-tree";
import {
  COHORT_MIN_CELL,
  COHORT_WINDOW_DAYS,
  isPublishableCell,
  positionOf,
  suppressSmallCells,
  type CohortCell,
} from "../../src/lib/cohort";

const cell = (n: number): CohortCell => ({
  dimensionId: "depth",
  n,
  p25: 2,
  p50: 3,
  p75: 4,
});

describe("the floor is ten and cannot be argued down", () => {
  it("publishes at the boundary and hides below it", () => {
    expect(isPublishableCell(COHORT_MIN_CELL)).toBe(true);
    expect(isPublishableCell(COHORT_MIN_CELL - 1)).toBe(false);
    expect(COHORT_MIN_CELL).toBe(10);
    expect(COHORT_WINDOW_DAYS).toBe(180);
  });

  it("drops small and malformed cells instead of coercing them", () => {
    const rows = [
      { dimension_id: "depth", n: 9, p25: 2, p50: 3, p75: 4 },
      { dimension_id: "depth", n: 10, p25: 2, p50: 3, p75: 4 },
      { dimension_id: "communication", n: "10", p25: 1, p50: 2, p75: 3 },
      { dimension_id: "", n: 20, p25: 1, p50: 2, p75: 3 },
      { dimension_id: "specificity", n: 20, p25: 4, p50: 3, p75: 2 },
      { dimension_id: "star", n: 20, p25: 1, p50: 2, p75: null },
      null,
      "not a row",
    ];
    const out = suppressSmallCells(rows);
    expect(out.map((c) => c.dimensionId)).toEqual(["depth", "communication"]);
    expect(out[0].n).toBe(10);
  });

  it("treats a non-array response as no measurement", () => {
    expect(suppressSmallCells(null)).toEqual([]);
    expect(suppressSmallCells({ rows: [] })).toEqual([]);
    expect(suppressSmallCells(undefined)).toEqual([]);
  });
});

describe("position is coarse on purpose", () => {
  it("says below, near or above the interquartile range", () => {
    expect(positionOf(1, cell(10))).toBe("below");
    expect(positionOf(2, cell(10))).toBe("near");
    expect(positionOf(3, cell(10))).toBe("near");
    expect(positionOf(4, cell(10))).toBe("near");
    expect(positionOf(5, cell(10))).toBe("above");
  });
});

describe("the SQL cannot be lowered by a caller", () => {
  const sql = readRepo("supabase/migrations/009_cohort_benchmarks.sql");
  /** The parameter list, which is the only place a caller can influence this. */
  const signature = (
    /CREATE OR REPLACE FUNCTION public\.cohort_benchmarks\(([^)]*)\)/.exec(sql)?.[1] ?? ""
  )
    .replace(/\s+/g, " ")
    .trim();

  it("takes exactly the two cohort keys, and no threshold or window", () => {
    expect(signature).toBe("p_interview_type text, p_rubric_id text");
  });

  it("hard-codes the floor instead of taking it as a parameter", () => {
    expect(sql).toContain("HAVING count(*) >= 10");
    expect(
      signature,
      "a min_cell parameter would let any caller pass 1 and read one person's row"
    ).not.toContain("min_cell");
  });

  it("hard-codes the window for the same reason", () => {
    expect(sql).toContain("interval '180 days'");
    expect(signature, "a days parameter lets a caller widen the sample until a cell passes").not.toContain(
      "days"
    );
  });

  it("returns aggregates only, and only to signed-in readers", () => {
    expect(sql).toContain("percentile_cont(0.25)");
    expect(sql).toContain("percentile_cont(0.50)");
    expect(sql).toContain("percentile_cont(0.75)");
    expect(sql).toContain("TO authenticated");
    expect(sql, "anonymous callers must not be able to probe tracks").not.toMatch(
      /GRANT EXECUTE ON FUNCTION public\.cohort_benchmarks\(text, text\) TO (anon|PUBLIC)/
    );
    expect(sql).toContain("SECURITY DEFINER");
    expect(sql).toContain("SET search_path = public, pg_temp");
  });
});

describe("the card cannot show a number the floor forbids", () => {
  const card = readRepo("src/components/evaluation/CohortCard.tsx");

  it("filters through the shared floor and says so when the cohort is thin", () => {
    expect(card).toContain("suppressSmallCells");
    expect(card).toContain("同类样本还不够");
    expect(card).toContain("COHORT_MIN_CELL");
  });

  it("does not render for a local-only session or an unknown rubric", () => {
    expect(card).toContain("!enabled || !interviewType || !rubricId");
  });

  it("is mounted on the report page", () => {
    const page = readRepo("src/app/dashboard/report/[id]/page.tsx");
    expect(page).toContain("<CohortCard");
  });
});
