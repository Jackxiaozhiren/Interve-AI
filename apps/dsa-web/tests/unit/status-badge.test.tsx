import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { StatusBadge } from "@/app/components/data/StatusBadge";

function badgeClass(status: string): string {
  const { container } = render(<StatusBadge status={status} />);
  const badge = container.querySelector('[aria-label^="status:"]');
  return badge?.getAttribute("class") ?? "";
}

describe("StatusBadge mapping", () => {
  it("maps COMPLETED family to success", () => {
    for (const s of ["COMPLETED", "SUCCEEDED", "OK", "PASSED", "SUCCESS"]) {
      expect(badgeClass(s)).toMatch(/emerald/);
    }
  });

  it("maps FAILED family to danger", () => {
    for (const s of ["FAILED", "FAIL", "ERROR"]) {
      expect(badgeClass(s)).toMatch(/red/);
    }
  });

  it("maps RUNNING family to warning", () => {
    for (const s of ["RUNNING", "PENDING", "QUEUED"]) {
      expect(badgeClass(s)).toMatch(/amber/);
    }
  });

  it("maps CANCELLED to default", () => {
    expect(badgeClass("CANCELLED")).toMatch(/zinc/);
  });

  it("is case-insensitive", () => {
    expect(badgeClass("completed")).toMatch(/emerald/);
    expect(badgeClass("failed")).toMatch(/red/);
  });

  it("falls back via substrings (FAIL/ERROR → danger)", () => {
    expect(badgeClass("STEP_FAILED_TIMEOUT")).toMatch(/red/);
  });

  it("falls back via substrings (RUN/PEND → warning)", () => {
    expect(badgeClass("RUN_QUEUED_AGAIN")).toMatch(/amber/);
  });

  it("falls back to default for unknown statuses", () => {
    expect(badgeClass("MYSTERIOUS")).toMatch(/zinc/);
  });

  it("preserves the raw status text and aria-label", () => {
    render(<StatusBadge status="COMPLETED" />);
    const el = screen.getByLabelText("status: COMPLETED");
    expect(el.textContent).toContain("COMPLETED");
  });
});
