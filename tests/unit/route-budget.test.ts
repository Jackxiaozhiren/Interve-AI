import { describe, expect, it } from "vitest";
import { readRepo, walkRepo } from "./repo-tree";

/**
 * A route's request guard and its function duration budget are two numbers in
 * two places that have to agree, and nothing checked it until parse-resume
 * surfaced the cost: the guard was prepared to wait, the platform was not, and
 * the user got a body that was not JSON.
 *
 * The rule is repo-static and needs no platform knowledge: if the guard says
 * `timeoutMs: N`, the function must declare `maxDuration >= ceil(N / 1000)`,
 * otherwise the code is waiting on a request the runtime has already killed.
 *
 * Routes with no guard timeout are not asserted on — several edge routes call
 * a model without one, which is a convention gap rather than a contradiction
 * between two numbers the repository actually contains.
 */
const routeFiles = () => walkRepo("src/app/api", (rel) => rel.endsWith("route.ts"));

interface Budget {
  route: string;
  timeoutMs: number | null;
  maxDuration: number | null;
}

function readBudgets(): Budget[] {
  return routeFiles().map((file) => {
    const src = readRepo(file);
    const timeout = src.match(/timeoutMs:\s*([0-9_]+)/)?.[1]?.replace(/_/g, "");
    const duration = src.match(/export\s+const\s+maxDuration\s*=\s*(\d+)/)?.[1];
    return {
      route: file,
      timeoutMs: timeout ? Number(timeout) : null,
      maxDuration: duration ? Number(duration) : null,
    };
  });
}

describe("route guard timeout vs function duration budget", () => {
  const budgets = readBudgets();

  it("the probe reads real routes, not an empty directory", () => {
    // Without this, a broken path or regex would make every assertion below
    // pass by finding nothing.
    expect(budgets.length).toBeGreaterThanOrEqual(15);
    const withGuardTimeout = budgets.filter((b) => b.timeoutMs !== null);
    expect(withGuardTimeout.length).toBeGreaterThanOrEqual(10);
    const withBudget = budgets.filter((b) => b.maxDuration !== null);
    expect(withBudget.length).toBeGreaterThanOrEqual(9);
  });

  it("every guard that waits has a function budget that outlasts it", () => {
    const violations = budgets
      .filter((b) => b.timeoutMs !== null)
      .filter((b) => b.maxDuration === null || b.timeoutMs! > b.maxDuration! * 1000)
      .map((b) => `${b.route} guard=${b.timeoutMs}ms budget=${b.maxDuration ?? "none"}`);
    expect(violations, `guards outliving their functions:\n  ${violations.join("\n  ")}`).toEqual([]);
  });

  it("no budget is padded absurdly beyond what the guard will wait", () => {
    // The other direction: a 170s function whose guard gives up after 5s is
    // paying for headroom nothing uses, and it hides a guard that was never
    // meant to be that short.
    const odd = budgets
      .filter((b) => b.timeoutMs !== null && b.maxDuration !== null)
      .filter((b) => b.maxDuration! * 1000 > b.timeoutMs! * 4)
      .map((b) => `${b.route} budget=${b.maxDuration}s guard=${b.timeoutMs}ms`);
    expect(odd, `budget far beyond the guard:\n  ${odd.join("\n  ")}`).toEqual([]);
  });
});
