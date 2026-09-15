import { defineConfig } from "vitest/config";
import path from "node:path";

// Phase 2: unit + integration tests only. Playwright specs under
// tests/*.spec.ts and tests/e2e/ are excluded (different runner).
export default defineConfig({
  resolve: {
    // Mirror tsconfig "@/* -> ./src/*" so tests can import "@/lib/..." too.
    alias: { "@": path.resolve(__dirname, "src") },
  },
  test: {
    environment: "node",
    include: ["tests/unit/**/*.test.ts", "tests/integration/**/*.test.ts"],
    reporters: ["default"],
    // Fail closed when tests import browser-only modules.
    server: { deps: { inline: [] } },
  },
});
