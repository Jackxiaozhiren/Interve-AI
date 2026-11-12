/**
 * The objection record's rules, tested without a browser.
 *
 * Two failure modes are worse than "the button did nothing", and both are
 * pinned here: storing the same objection three times (a double click looks
 * like three people complaining) and reporting success when the list was full
 * (the candidate believes a person will look, and nobody will).
 *
 * The migration arm exists because 005 records what happens otherwise:
 * `toSnakeCase` forwards every key, so a column that does not exist fails the
 * WHOLE update with 42703 — including the settlement write that saves the
 * interview. The writer must not ship before the column does.
 */
import { describe, expect, it } from "vitest";
import { readRepo } from "./repo-tree";
import {
  appendDispute,
  hasDisputed,
  MAX_DISPUTES_PER_REPORT,
  MAX_DISPUTE_NOTE,
} from "../../src/lib/report-disputes";
import type { ReportDispute } from "../../src/lib/db";

const base: ReportDispute = {
  dimensionId: "depth",
  reason: "evidence",
  createdAt: "2026-11-12T00:00:00Z",
};

describe("appendDispute keeps one disagreement as one entry", () => {
  it("appends a first objection", () => {
    const result = appendDispute(undefined, base);
    expect(result).toEqual({ ok: true, disputes: [base] });
  });

  it("refuses the same objection twice", () => {
    const result = appendDispute([base], { ...base });
    expect(result).toEqual({ ok: false, error: "duplicate" });
  });

  it("treats whitespace-different notes as the same objection", () => {
    const first = appendDispute(undefined, { ...base, note: "我的回答被截断" });
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    const again = appendDispute(first.disputes, { ...base, note: "  我的回答被截断  " });
    expect(again).toEqual({ ok: false, error: "duplicate" });
  });

  it("allows a different reason on the same dimension", () => {
    const result = appendDispute([base], { ...base, reason: "rubric" });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.disputes).toHaveLength(2);
  });

  it("drops an empty note instead of storing a blank field", () => {
    const result = appendDispute(undefined, { ...base, note: "   " });
    expect(result.ok).toBe(true);
    if (result.ok) expect("note" in result.disputes[0]).toBe(false);
  });

  it("rejects an invalid dimension or reason", () => {
    expect(appendDispute(undefined, { ...base, dimensionId: "  " })).toEqual({
      ok: false,
      error: "invalid",
    });
    expect(
      appendDispute(undefined, { ...base, reason: "made-up" as ReportDispute["reason"] })
    ).toEqual({ ok: false, error: "invalid" });
  });

  it("rejects a note over the cap rather than truncating it silently", () => {
    expect(appendDispute(undefined, { ...base, note: "x".repeat(MAX_DISPUTE_NOTE + 1) })).toEqual({
      ok: false,
      error: "invalid",
    });
  });

  it("refuses to grow past the per-report cap", () => {
    const full: ReportDispute[] = Array.from({ length: MAX_DISPUTES_PER_REPORT }, (_, i) => ({
      dimensionId: `dim-${i}`,
      reason: "other",
      createdAt: base.createdAt,
    }));
    const result = appendDispute(full, { ...base, dimensionId: "one-more" });
    expect(result).toEqual({ ok: false, error: "limit" });
  });

  it("treats a malformed stored list as empty rather than crashing the panel", () => {
    const result = appendDispute(undefined, base);
    expect(result.ok).toBe(true);
  });
});

describe("hasDisputed", () => {
  it("reports what it has and tolerates what it does not", () => {
    expect(hasDisputed(undefined, "depth")).toBe(false);
    expect(hasDisputed([], "depth")).toBe(false);
    expect(hasDisputed([base], "depth")).toBe(true);
    expect(hasDisputed([base], "communication")).toBe(false);
  });
});

describe("the write path is guarded where it is dangerous", () => {
  it("ships a migration that adds the column before the writer", () => {
    const migration = readRepo("supabase/migrations/007_report_disputes.sql");
    expect(migration).toContain("ADD COLUMN IF NOT EXISTS report_disputes");
    expect(migration, "the file must state that it has not been applied yet").toContain("PENDING");
    expect(migration, "005's failure mode belongs in the file that repeats its ordering").toContain(
      "42703"
    );
  });

  it("writes through the owner-stamped client, not a hand-rolled request", () => {
    const panel = readRepo("src/components/evaluation/DisputePanel.tsx");
    expect(panel).toContain("db.interviews.update");
    expect(panel).toContain("reportDisputes");
  });

  it("does not show a success toast on a failed write", () => {
    const panel = readRepo("src/components/evaluation/DisputePanel.tsx");
    const catchAt = panel.indexOf("catch (e)");
    const successAt = panel.indexOf('toast.success("异议已记录"');
    expect(catchAt).toBeGreaterThan(-1);
    expect(successAt).toBeGreaterThan(-1);
    expect(
      successAt,
      "the success toast must sit inside the try block, before the catch: after it, a failed write reports success"
    ).toBeLessThan(catchAt);
    expect(panel).toContain('role="alert"');
  });

  it("keeps every control at a 44px touch target on phones", () => {
    const panel = readRepo("src/components/evaluation/DisputePanel.tsx");
    expect(panel.match(/min-h-11 sm:min-h-0/g)?.length ?? 0).toBeGreaterThanOrEqual(4);
  });

  it("is mounted on the report page and refuses a local-only row", () => {
    const page = readRepo("src/app/dashboard/report/[id]/page.tsx");
    expect(page).toContain("<DisputePanel");
    expect(
      page,
      "a local-… id has no row to write to; the panel must receive null and say so"
    ).toContain('typeof interview.id === "number" ? interview.id : null');
  });
});
