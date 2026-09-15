/** 390px mobile: every route renders with zero horizontal overflow (mock lane). */
import { expect, test } from "@playwright/test";
import {
  ROUTES_14,
  expectNoOverflow,
  expectNoWhitescreen,
  mockApi,
  shouldUseMocks,
} from "./helpers";

for (const route of ROUTES_14) {
  test(`mobile-390 no overflow: ${route}`, async ({ page }) => {
    test.skip(!shouldUseMocks(), "needs E2E_MOCK=1");
    await page.setViewportSize({ width: 390, height: 844 });
    await mockApi(page, "normal");
    await page.goto(route);
    await expect(page.locator("#main-content")).toBeVisible();
    await expectNoWhitescreen(page);
    await expectNoOverflow(page);
  });
}
