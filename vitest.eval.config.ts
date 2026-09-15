import { defineConfig } from "vitest/config";
import path from "node:path";

// Phase 11 eval lane: golden/stability/injection/fairness suites.
// Keyless runs skip with a message and exit 0 (see evals/runner.ts).
export default defineConfig({
  resolve: {
    alias: { "@": path.resolve(__dirname, "src") },
  },
  test: {
    environment: "node",
    include: ["evals/**/*.eval.test.ts"],
    reporters: ["default"],
    testTimeout: 600_000,
    hookTimeout: 60_000,
  },
});
