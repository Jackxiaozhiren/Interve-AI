// Phase A2: nightly workflow dry-run (keyless static contract).
//
// The workflow can only EXECUTE with secrets (by design: fork-safe skip),
// so the keyless gate pins its wiring as text: schedule + manual trigger,
// never per-PR; secret gates; all four lanes serial with fixed caps;
// trend artifact always uploaded; failures recorded, never merge-blocking.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

const yml = readFileSync(new URL("../../.github/workflows/nightly-eval.yml", import.meta.url), "utf8");

describe("nightly-eval.yml wiring", () => {
  it("triggers on schedule + manual only (never per-PR/per-push)", () => {
    expect(yml).toContain("schedule:");
    expect(yml).toContain("workflow_dispatch");
    expect(yml).not.toMatch(/^\s*(push|pull_request)\s*:/m);
  });

  it("is secret-gated and fork-safe (skips green without keys)", () => {
    expect(yml).toContain("secrets.ZHIPU_API_KEY != ''");
    expect(yml).toContain("secrets.GOOGLE_GENERATIVE_AI_API_KEY != ''");
  });

  it("runs all four lanes serial with fixed call caps", () => {
    for (const lane of ["test:eval:free", "practice-golden.eval.test.ts", "turn-golden.eval.test.ts", "test:eval"]) {
      expect(yml, lane).toContain(lane);
    }
    // No parallel matrix (free tier is 1-concurrency) and no overlap burns.
    expect(yml).not.toContain("matrix:");
    expect(yml).toContain("cancel-in-progress: true");
  });

  it("records trend JSON and uploads it even when lanes fail", () => {
    expect(yml).toContain("nightly-trend.json");
    expect(yml).toContain("actions/upload-artifact@v4");
    expect(yml).toContain("continue-on-error: true");
  });

  it("documents the free-tier cost math in-file", () => {
    expect(yml).toContain("37");
    expect(yml).toContain("08:00 UTC");
  });
});
