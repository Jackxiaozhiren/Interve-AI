/**
 * Shared Playwright helpers for DSA tri-state E2E.
 * Mocking rule: `E2E_MOCK=1` intercepts `http://localhost:8000` with fixtures;
 * unset → requests pass through to the real backend (default: no pollution).
 */
import type { Page } from "@playwright/test";
import {
  fixtureAnalyses,
  fixtureBenchmarks,
  fixtureDatasetProfile,
  fixtureDatasets,
  fixtureRunDetails,
} from "../../mocks/fixtures";

export const DSA_API = "http://localhost:8000";
export const shouldUseMocks = () => process.env.E2E_MOCK === "1";

export const ROUTES_14 = [
  "/",
  "/analysis",
  "/analysis/run_001",
  "/benchmarks",
  "/datasets",
  "/datasets/sales_q3",
  "/evaluations",
  "/failures",
  "/mcp",
  "/reports",
  "/research",
  "/runs",
  "/runs/run_001",
  "/runs/run_001/replay",
] as const;

function payloadFor(url: string): unknown {
  const u = new URL(url);
  const p = u.pathname;
  if (p === "/health") return { status: "ok" };
  if (p === "/datasets") return fixtureDatasets;
  if (p.startsWith("/datasets/"))
    return fixtureDatasetProfile(decodeURIComponent(p.slice("/datasets/".length)));
  if (p === "/analysis" || p === "/reports" || p === "/runs") return fixtureAnalyses;
  if (p.startsWith("/analysis/"))
    return (
      fixtureRunDetails.find((r) => r.id === decodeURIComponent(p.slice("/analysis/".length))) ??
      fixtureRunDetails[0]
    );
  if (p === "/benchmarks") return fixtureBenchmarks;
  if (p.endsWith("/replay")) {
    const id = decodeURIComponent(p.split("/")[2]);
    return fixtureRunDetails.find((r) => r.id === id) ?? fixtureRunDetails[0];
  }
  if (p.startsWith("/runs/"))
    return (
      fixtureRunDetails.find((r) => r.id === decodeURIComponent(p.slice("/runs/".length))) ??
      fixtureRunDetails[0]
    );
  return {};
}

/** Intercept localhost:8000 with fixtures (mock lane) or let through (real lane). */
export async function mockApi(
  page: Page,
  mode: "normal" | "empty" | "error" | "delayed" = "normal",
) {
  const ctl = await mockApiController(page);
  ctl.setMode(mode);
  return ctl;
}

export type MockMode = "normal" | "empty" | "error" | "delayed";

/**
 * Single route registration whose behavior follows a mutable mode.
 * Avoids unroute/re-register races with in-flight delayed responses.
 */
export async function mockApiController(page: Page) {
  let mode: MockMode = "normal";
  if (shouldUseMocks()) {
    await page.route(`${DSA_API}/**`, async (route) => {
      const req = route.request();
      const m = mode;
      if (req.method() === "POST" && req.url().endsWith("/datasets")) {
        if (m === "error")
          return route.fulfill({ status: 413, json: { detail: "Payload too large" } });
        return route.fulfill({ status: 201, json: fixtureDatasets[0] });
      }
      if (req.method() === "POST" && req.url().endsWith("/analysis")) {
        if (m === "error")
          return route.fulfill({ status: 422, json: { detail: "query too long" } });
        return route.fulfill({ status: 201, json: fixtureAnalyses[0] });
      }
      if (m === "error")
        return route.fulfill({ status: 500, json: { detail: "mock failure" } });
      if (m === "empty") {
        const url = new URL(req.url());
        if (url.pathname === "/health") return route.fulfill({ json: { status: "ok" } });
        if (url.pathname.startsWith("/analysis/") || url.pathname.startsWith("/runs/"))
          return route.fulfill({ status: 200, json: { ...fixtureRunDetails[0], plan: [], trace: [], evidence: [], insights: [], limitations: [], artifacts: [] } });
        if (url.pathname.startsWith("/datasets/"))
          return route.fulfill({ json: { ...fixtureDatasetProfile("empty_table"), preview: [], schema: [], analyses: [], lineage: [] } });
        return route.fulfill({ json: [] });
      }
      if (m === "delayed") {
        await new Promise((r) => setTimeout(r, 800));
        return route.fulfill({ json: payloadFor(req.url()) });
      }
      return route.fulfill({ json: payloadFor(req.url()) });
    });
  }
  return { setMode: (m: MockMode) => { mode = m; } };
}

/** Abort every backend call: simulates backend down / offline. */
export async function blackoutApi(page: Page) {
  await page.route(`${DSA_API}/**`, (route) => route.abort("failed"));
}

/** Hand-written overflow guard: scrollWidth must not exceed clientWidth. */
export async function expectNoOverflow(page: Page) {
  const overflow = await page.evaluate(() => {
    const bad: string[] = [];
    const doc = document.documentElement;
    if (doc.scrollWidth > doc.clientWidth + 1)
      bad.push(`document:${doc.scrollWidth}>${doc.clientWidth}`);
    // Only elements whose overflow propagates to the page matter.
    // overflow-x: hidden/auto/scroll containers clip or scroll internally
    // by design (hero decoration, DataTable scroller) — skip them.
    for (const el of Array.from(document.querySelectorAll("main *"))) {
      const h = el as HTMLElement;
      const ox = getComputedStyle(h).overflowX;
      if (ox !== "visible") continue;
      if (
        h.scrollWidth > h.clientWidth + 1 &&
        h.scrollWidth > document.documentElement.clientWidth + 1
      )
        bad.push(`${h.tagName}.${(h.className as string).toString().slice(0, 40)}:${h.scrollWidth}>${h.clientWidth}`);
      if (bad.length >= 5) break;
    }
    return bad;
  });
  if (overflow.length > 0) throw new Error(`horizontal overflow: ${overflow.join("; ")}`);
}

/** No white screen: header brand + main content present. */
export async function expectNoWhitescreen(page: Page) {
  const { expect } = await import("@playwright/test");
  await expect(page.getByRole("banner")).toBeVisible();
  await expect(page.locator("#main-content")).not.toBeEmpty();
}
