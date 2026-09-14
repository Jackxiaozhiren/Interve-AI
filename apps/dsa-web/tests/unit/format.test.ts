import { describe, expect, it } from "vitest";
import {
  confidencePct,
  runValidationPct,
  safeErrorText,
  validationPct,
} from "@/lib/format";

describe("validationPct (≤1 fraction vs >1 percent)", () => {
  it("maps 0~1 fractions to percent", () => {
    expect(validationPct(0.92)).toBe(92);
    expect(validationPct(0)).toBe(0);
    expect(validationPct(1)).toBe(100);
  });

  it("passes >1 percent-style values through", () => {
    expect(validationPct(85)).toBe(85);
    expect(validationPct(61.4)).toBe(61);
  });

  it("returns null for missing/NaN input", () => {
    expect(validationPct(undefined)).toBeNull();
    expect(validationPct(NaN)).toBeNull();
  });
});

describe("confidencePct", () => {
  it("normalizes fractions", () => {
    expect(confidencePct(0.71)).toBe(71);
  });

  it("keeps percent-style values", () => {
    expect(confidencePct(92)).toBe(92);
  });

  it("guards NaN", () => {
    expect(confidencePct(NaN)).toBe(0);
  });
});

describe("runValidationPct (page logic)", () => {
  it("returns 0 for null data", () => {
    expect(runValidationPct(null)).toBe(0);
  });

  it("prefers validation_rate (fraction)", () => {
    expect(runValidationPct({ validation_rate: 0.92, evidence: [] })).toBe(92);
  });

  it("prefers validation_rate (percent-style)", () => {
    expect(runValidationPct({ validation_rate: 85 })).toBe(85);
  });

  it("averages evidence when no rate (mixed ≤1 and >1)", () => {
    expect(
      runValidationPct({ evidence: [{ confidence: 0.9 }, { confidence: 70 }] }),
    ).toBe(80);
  });

  it("returns 0 for empty evidence without rate", () => {
    expect(runValidationPct({ evidence: [] })).toBe(0);
  });
});

describe("safeErrorText (ErrorState de-tagging)", () => {
  it("strips HTML tags", () => {
    expect(safeErrorText('<script>alert(1)</script>API 500: boom')).toBe(
      "alert(1)API 500: boom",
    );
  });

  it("truncates to 500 chars", () => {
    expect(safeErrorText("x".repeat(600)).length).toBe(500);
  });

  it("keeps plain messages intact", () => {
    expect(safeErrorText("API 404: Not Found")).toBe("API 404: Not Found");
  });
});
