// S4.1/v3.4 named five @base-ui/react wrappers as the mechanically
// removable directives: "directive may carry weight, must build-test each".
// S5's server reads made a real RSC graph, so the build can now prove it.
// These contracts pin the reason the build passes: the wrappers have no
// hook, no browser call and no inline handler, and their importers already
// carry the client boundary. Re-adding a directive must redden this file.
import { describe, it, expect } from "vitest";
import { readRepo, walkRepo } from "./repo-tree";

const WRAPPERS = ["dialog", "progress", "scroll-area", "separator", "tooltip"];

// Reuse the shared walker: a second recursive walk in tests/ is itself a
// ratcheted debt (debt.repoWalkers), so adding one to prove a boundary would
// grow the very debt this slice removes.
const allFiles = walkRepo("src", (rel) => /\.(ts|tsx)$/.test(rel));

describe("@base-ui wrappers stay server-compatible", () => {
  for (const name of WRAPPERS) {
    const path = `src/components/ui/${name}.tsx`;
    const src = readRepo(path);

    it(`${name}: no client directive`, () => {
      expect(src).not.toMatch(/^\s*["']use client["']/m);
    });

    it(`${name}: no hook, browser API or inline handler`, () => {
      expect(src).not.toMatch(/use[A-Z][a-zA-Z]*\s*\(/);
      expect(src).not.toMatch(/\b(window|document|localStorage|navigator)\./);
      expect(src).not.toMatch(/\bon(Click|Change|KeyDown|Input)\s*=/);
    });
  }

  it("every importer of a wrapper is itself a client component", () => {
    // A server file importing one of these would break at build: base-ui's
    // internals use hooks and inherit the boundary from the importer. The
    // build proves it for today's tree; this pins the reason in source.
    const importers = allFiles.filter(
      (f) =>
        f !== "src/components/ui/tooltip.tsx" &&
        WRAPPERS.some((n) => readRepo(f).includes(`components/ui/${n}`)),
    );
    for (const f of importers) {
      const src = readRepo(f);
      // A barrel only re-exports: no render, no hook, no client boundary
      // needed. The build proves it; pin the shape so a barrel that starts
      // rendering must take a side or grow a directive.
      const isBarrel = src.split("\n").every((line) => {
        const t = line.trim();
        return (
          t === "" ||
          t.startsWith("//") ||
          t.startsWith("/*") ||
          t.startsWith("*") ||
          t.endsWith("*/") ||
          /^export\s+\{[^}]*\}\s+from\s+["']/.test(t) ||
          /^export\s+\*\s+from\s+["']/.test(t)
        );
      });
      if (isBarrel) continue;
      expect(
        src,
        `${f} imports a base-ui wrapper without a client boundary`,
      ).toMatch(/^\s*["']use client["']/m);
    }
  });
});
