/**
 * The radar card may only draw a number that was measured.
 *
 * `summarizeReadiness` in this same module already states the rule — "an absent
 * number is reported as absent; 0 is reserved for a candidate who scored zero" —
 * and the skill-breakdown card did not follow it. Every axis ended in `?? 0` /
 * `|| 0`, so a candidate whose latest session had three of six dimensions, or
 * whose first session predates the Body Lang and Pressure axes entirely, was
 * shown a polygon running through the centre: 0/100 on abilities nobody scored,
 * and a "First Session" baseline that was really just an absence.
 *
 * A practice product that draws zeros where it has no data tells the user they
 * failed at things they were never asked. That is the whole reason this file
 * exists.
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { radarSeries } from "../../src/lib/dashboard-stats";

const SUBJECTS = [
  { id: "logic", name: "Logic" },
  { id: "expression", name: "Expression" },
  { id: "pressure", name: "Pressure" },
  { id: "bodyLanguage", name: "Body Lang" },
];

describe("axes the latest session actually measured", () => {
  it("draws every axis it has a number for", () => {
    const out = radarSeries(
      { logic: 80, expression: 60, pressure: 70, bodyLanguage: 90 },
      undefined,
      SUBJECTS
    );
    expect(out.axes.map((a) => a.subject)).toEqual(["Logic", "Expression", "Pressure", "Body Lang"]);
    expect(out.axes[0]).toMatchObject({ subject: "Logic", A: 80 });
  });

  it("omits an axis that has no measurement instead of drawing 0", () => {
    // This is the case the `?? 0` hid: a rubric with three dimensions, or a
    // legacy row whose radarScores object predates the later axes.
    const out = radarSeries({ logic: 75, expression: null }, undefined, SUBJECTS);
    expect(out.axes).toEqual([{ subject: "Logic", A: 75 }]);
    expect(JSON.stringify(out.axes)).not.toContain('"A":0');
  });

  it("keeps a real zero, because zero is a measurement too", () => {
    const out = radarSeries({ logic: 0 }, undefined, SUBJECTS);
    expect(out.axes).toEqual([{ subject: "Logic", A: 0 }]);
  });

  it("says there is nothing to draw when nothing is measured", () => {
    const out = radarSeries({ logic: undefined }, {}, SUBJECTS);
    expect(out.axes).toEqual([]);
    expect(out.comparable).toBe(false);
  });

  it("tolerates a missing session entirely", () => {
    expect(radarSeries(undefined, undefined, SUBJECTS)).toEqual({ axes: [], comparable: false });
    expect(radarSeries(null, null, SUBJECTS).axes).toEqual([]);
  });
});

describe("the comparison series", () => {
  it("compares when the first session measured every axis shown", () => {
    const out = radarSeries(
      { logic: 80, expression: 70 },
      { logic: 40, expression: 50, pressure: 60 },
      SUBJECTS
    );
    expect(out.comparable).toBe(true);
    expect(out.axes).toEqual([
      { subject: "Logic", A: 80, B: 40 },
      { subject: "Expression", A: 70, B: 50 },
    ]);
  });

  it("drops the comparison instead of inventing a zero baseline for a newer axis", () => {
    // Body Lang was added to the rubric later, so the first session has no
    // number for it. Drawing B: 0 there would claim the candidate began at zero
    // on an axis they were never scored on — and the card's own "First Session"
    // legend would be a fiction. The whole comparison is dropped, which costs a
    // line on the chart rather than a lie.
    const out = radarSeries(
      { logic: 80, bodyLanguage: 60 },
      { logic: 40 },
      SUBJECTS
    );
    expect(out.comparable).toBe(false);
    expect(out.axes.every((a) => !("B" in a))).toBe(true);
    expect(out.axes).toHaveLength(2);
  });

  it("does not compare a session against itself", () => {
    const out = radarSeries({ logic: 80 }, undefined, SUBJECTS);
    expect(out.comparable).toBe(false);
  });

  it("needs a number, not just a key, in the first session", () => {
    expect(radarSeries({ logic: 80 }, { logic: null }, SUBJECTS).comparable).toBe(false);
    expect(radarSeries({ logic: 80 }, { logic: undefined }, SUBJECTS).comparable).toBe(false);
  });
});

it("orders the axes by the subject list, not by object key order", () => {
  const out = radarSeries({ bodyLanguage: 10, logic: 20, expression: 30 }, undefined, SUBJECTS);
  expect(out.axes.map((a) => a.subject)).toEqual(["Logic", "Expression", "Body Lang"]);
});

/**
 * The card's own wiring. A pure function nobody calls is not a fix, and the two
 * shapes below are exactly what the page used to do: zero-fill an absent axis and
 * decide the comparison series from a session count rather than from whether the
 * first session has numbers.
 */
describe("the dashboard card", () => {
  const page = readFileSync(
    new URL("../../src/app/dashboard/page.tsx", import.meta.url),
    "utf8"
  );

  it("builds the radar through the measured-only series", () => {
    expect(page).toMatch(/radarSeries\(/);
    expect(page).not.toMatch(/radarScores\.\w+ \|\| 0/);
    expect(page).not.toMatch(/score100 \?\? 0/);
  });

  it("shows the comparison only when the series has one", () => {
    expect(page).toMatch(/showFirst=\{radar\.comparable\}/);
    expect(page).not.toMatch(/showFirst=\{completedSessions\.length > 1\}/);
  });

  it("labels the card from the same fact the chart is drawn from", () => {
    // "Latest vs First" was static, so it sat above a single-series chart.
    expect(page).toMatch(/radar\.comparable\s*\?\s*"Latest vs First"\s*:\s*"Latest session"/);
  });
});
