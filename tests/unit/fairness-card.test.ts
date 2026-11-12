/**
 * The fairness card exists to make one distinction the product used to blur:
 * "we measured and found no flips" versus "we never measured".
 *
 * A zero produced by an empty audit is not evidence of fairness, so
 * `summarizeFairness` returns `null` for anything unmeasured and the card says
 * so in words. These arms pin that contract, the rate arithmetic, and the
 * card's copy — including the refusal to print a percentage when there is no
 * measurement behind it.
 */
import { describe, expect, it } from "vitest";
import { readRepo } from "./repo-tree";
import { formatMeasuredAt, formatRate, summarizeFairness } from "../../src/lib/fairness";

const measured = {
  version: "1.0.0",
  measuredAt: "2026-11-11T10:00:00Z",
  model: "glm-4-flash",
  runs: 6,
  cells: [
    { attribute: "name", label: "姓名与代词", flips: 1, n: 3 },
    { attribute: "org-type", label: "机构类型", flips: 0, n: 3 },
  ],
};

describe("summarizeFairness refuses to turn absence into zero", () => {
  it("returns null for a missing or empty audit", () => {
    expect(summarizeFairness(null)).toBeNull();
    expect(summarizeFairness(undefined)).toBeNull();
    expect(summarizeFairness({})).toBeNull();
    expect(summarizeFairness({ ...measured, cells: [] })).toBeNull();
    expect(
      summarizeFairness({ ...measured, cells: [{ attribute: "name", label: "姓名", flips: 0, n: 0 }] }),
      "a cell with n=0 is not a measurement"
    ).toBeNull();
  });

  it("returns null for a malformed or impossible cell", () => {
    expect(summarizeFairness({ ...measured, measuredAt: null })).toBeNull();
    expect(summarizeFairness({ ...measured, model: "" })).toBeNull();
    expect(
      summarizeFairness({ ...measured, cells: [{ attribute: "name", label: "姓名", flips: 3, n: 1 }] }),
      "more flips than runs cannot be a real reading"
    ).toBeNull();
    expect(
      summarizeFairness({ ...measured, cells: [{ attribute: "name", label: "姓名", flips: -1, n: 3 }] })
    ).toBeNull();
  });

  it("produces a non-zero reading for a fixture with flips", () => {
    const reading = summarizeFairness(measured)!;
    expect(reading).not.toBeNull();
    expect(reading.flips).toBe(1);
    expect(reading.runs).toBe(6);
    expect(reading.rate).toBeGreaterThan(0);
    expect(reading.cells.find((c) => c.attribute === "name")!.rate).toBeCloseTo(1 / 3);
  });

  it("keeps a measured zero distinct from no measurement", () => {
    const reading = summarizeFairness({
      ...measured,
      cells: [{ attribute: "name", label: "姓名", flips: 0, n: 3 }],
    })!;
    expect(reading).not.toBeNull();
    expect(reading.rate).toBe(0);
    expect(reading.runs).toBe(3);
  });
});

describe("rate formatting never inflates", () => {
  it("formats the common rates", () => {
    expect(formatRate(0)).toBe("0%");
    expect(formatRate(0.5)).toBe("50%");
    expect(formatRate(1)).toBe("100%");
    expect(formatRate(1 / 3)).toBe("33.3%");
  });

  it("truncates rather than rounds up", () => {
    expect(formatRate(0.16666)).toBe("16.6%");
  });

  it("formats the measurement date without a locale", () => {
    expect(formatMeasuredAt("2026-11-11T10:00:00Z")).toBe("2026-11-11");
    expect(formatMeasuredAt("not-a-date")).toBe("not-a-date");
  });
});

describe("the card says which case it is in", () => {
  const card = readRepo("src/components/evaluation/FairnessCard.tsx");

  it("names the section and the measured reading", () => {
    expect(card).toContain("评分公平性");
    expect(card).toContain("翻转率");
    expect(card).toContain("formatRate");
  });

  it("states the unmeasured case in words instead of printing a number", () => {
    expect(card).toContain("还没有完成");
    expect(card).toContain("不显示任何数字");
  });

  it("renders from the pure reading rather than computing inside the view", () => {
    expect(card).toContain("summarizeFairness");
    expect(card).toContain("!reading");
  });

  it("is mounted on the report page with the audit artifact", () => {
    const page = readRepo("src/app/dashboard/report/[id]/page.tsx");
    expect(
      page,
      "the card exists but nothing renders it: the candidate still cannot see the measurement"
    ).toContain("<FairnessCard");
    expect(page).toContain("fairness-audit.json");
  });
});
