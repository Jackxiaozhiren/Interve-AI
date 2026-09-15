/** Upload failure + offline/whitescreen regression (mock lane). */
import { expect, test } from "@playwright/test";
import {
  blackoutApi,
  expectNoWhitescreen,
  mockApiController,
  shouldUseMocks,
} from "./helpers";

test("datasets upload failure surfaces a friendly error (413)", async ({ page }) => {
  test.skip(!shouldUseMocks(), "needs E2E_MOCK=1");
  const api = await mockApiController(page);
  api.setMode("normal");
  await page.goto("/datasets");
  await expect(page.getByText("sales_q3.csv").first()).toBeVisible();

  // Flip to error mode: POST /datasets → 413, reads keep working.
  api.setMode("error");

  await page.setInputFiles("#dataset-file", {
    name: "huge.csv",
    mimeType: "text/csv",
    buffer: Buffer.from("a,b\n1,2\n"),
  });
  await expect(page.getByText(/Upload failed \(413/, { exact: false })).toBeVisible();
  await expectNoWhitescreen(page);
});

test("backend down → no whitescreen anywhere (header API down + ErrorState + retry)", async ({
  page,
}) => {
  await blackoutApi(page);
  for (const route of ["/", "/datasets", "/runs", "/benchmarks"]) {
    await page.goto(route);
    await expectNoWhitescreen(page);
    // Data pages must show an ErrorState with retry instead of blank content.
    if (route !== "/") {
      await expect(page.locator("#main-content").getByRole("alert").first()).toBeVisible();
      await expect(page.getByRole("button", { name: "Retry" }).first()).toBeVisible();
    }
  }
  // Home shows the analyses ErrorState too.
  await page.goto("/");
  await expect(page.locator("#main-content").getByRole("alert").first()).toBeVisible();
  // Top-bar health pill reports down: desktop pill (title attr) + mobile menu text.
  await expect(page.getByTitle("API down")).toBeAttached();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "Open menu" }).click();
  await expect(page.getByText("API status: down")).toBeVisible();
});
