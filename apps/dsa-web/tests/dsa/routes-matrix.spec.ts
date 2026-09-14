/**
 * Tri-state matrix: loading / empty / error / normal × 14 routes.
 * Mock lane (`E2E_MOCK=1`); without it these specs run against the real API
 * and only the "normal" assertions are meaningful.
 */
import { expect, test } from "@playwright/test";
import {
  expectNoWhitescreen,
  mockApiController,
  useMocks,
} from "./helpers";

interface RowSpec {
  route: string;
  loading: string;
  normal: string[];
  /** Selectors that must be attached (e.g. <option> text is not visible). */
  normalAttached?: string[];
  empty: string[];
  errors: boolean;
}

const MATRIX: RowSpec[] = [
  { route: "/", loading: "Loading", normal: ["Recent analyses", "Revenue grew 12% in Q3"], empty: ["No analyses yet"], errors: true },
  { route: "/analysis", loading: "Ask a question", normal: ["Ask a question", "Run analysis"], normalAttached: ['option[value="sales_q3"]'], empty: ["Ask a question"], errors: true },
  { route: "/analysis/run_001", loading: "Loading run", normal: ["Revenue grew 12% in Q3"], empty: ["Revenue grew 12% in Q3"], errors: true },
  { route: "/benchmarks", loading: "label:Loading", normal: ["V1 vs V2 by task"], empty: ["No benchmark data"], errors: true },
  { route: "/datasets", loading: "Loading datasets", normal: ["sales_q3.csv"], empty: ["No datasets yet"], errors: true },
  { route: "/datasets/sales_q3", loading: "Loading profile", normal: ["sales_q3.csv"], empty: ["No preview rows"], errors: true },
  { route: "/evaluations", loading: "Under construction", normal: ["Under construction"], empty: ["Under construction"], errors: false },
  { route: "/failures", loading: "Under construction", normal: ["Under construction"], empty: ["Under construction"], errors: false },
  { route: "/mcp", loading: "Under construction", normal: ["Under construction"], empty: ["Under construction"], errors: false },
  { route: "/reports", loading: "Loading reports", normal: ["run_001"], empty: ["No reports yet"], errors: true },
  { route: "/research", loading: "Reading path", normal: ["Reading path"], empty: ["Reading path"], errors: false },
  { route: "/runs", loading: "Loading runs", normal: ["run_001"], empty: ["No runs yet"], errors: true },
  { route: "/runs/run_001", loading: "Loading run", normal: ["Revenue grew 12% in Q3"], empty: ["Revenue grew 12% in Q3"], errors: true },
  { route: "/runs/run_001/replay", loading: "Loading replay", normal: ["Revenue grew 12% in Q3"], empty: ["No trace in replay"], errors: true },
];

for (const row of MATRIX) {
  test(`${row.route} → loading / normal / empty / error`, async ({ page }) => {
    test.skip(!useMocks(), "matrix needs E2E_MOCK=1");

    const api = await mockApiController(page);

    // loading (delayed backend → skeleton/shell still renders, no whitescreen)
    api.setMode("delayed");
    await page.goto(row.route);
    if (row.loading.startsWith("label:")) {
      await expect(page.getByLabel(row.loading.slice("label:".length)).first()).toBeVisible();
    } else {
      await expect(page.getByText(row.loading, { exact: false }).first()).toBeVisible();
    }
    await expectNoWhitescreen(page);

    // normal
    api.setMode("normal");
    await page.goto(row.route);
    for (const text of row.normal) {
      await expect(page.getByText(text, { exact: false }).first()).toBeVisible();
    }
    for (const sel of row.normalAttached ?? []) {
      await expect(page.locator(sel).first()).toBeAttached();
    }
    await expectNoWhitescreen(page);

    // empty
    api.setMode("empty");
    await page.goto(row.route);
    for (const text of row.empty) {
      await expect(page.getByText(text, { exact: false }).first()).toBeVisible();
    }
    await expectNoWhitescreen(page);

    // error (backend 500 → ErrorState + Retry, never blank)
    api.setMode("error");
    await page.goto(row.route);
    if (row.errors) {
      await expect(page.locator("#main-content").getByRole("alert").first()).toBeVisible();
      await expect(page.getByRole("button", { name: "Retry" }).first()).toBeVisible();
    }
    await expectNoWhitescreen(page);
  });
}
