// Phone-width geometry. The rank-1 audience opens this on a phone, and until
// this file existed no project in playwright.config.ts used a phone viewport at
// all — every lane was a desktop window at three widths, so "works on mobile"
// was an assumption rather than a reading.
//
// These are geometry assertions, not screenshots: a baseline image only says the
// page looks the same as last time, while these say the content column is wide
// enough to read and that nothing pushes the document sideways.
import { test, expect } from "@playwright/test";
import { loginAs } from "../helpers";

test.describe("phone width (390x844)", () => {
  test("the dashboard is laid out for a phone, not a shrunken desktop", async ({ page }) => {
    await loginAs(page);
    await page.goto("/dashboard");
    await page.waitForLoadState("domcontentloaded");

    const m = await page.evaluate(() => {
      const main = document.querySelector("main");
      return {
        vw: window.innerWidth,
        docScroll: document.documentElement.scrollWidth,
        mainW: main ? Math.round(main.getBoundingClientRect().width) : 0,
      };
    });

    // Nothing may push the document sideways. One pixel of slack absorbs
    // sub-pixel rounding, which is not a layout decision.
    expect(m.docScroll, "no horizontal scroll at phone width").toBeLessThanOrEqual(m.vw + 1);

    // And the content column has to stay usable. "No scrollbar" is satisfiable by
    // squeezing the content to nothing, which is the failure this asserts against:
    // a 280px sidebar plus 24px gutters leaves ~60px on a 390px screen.
    expect(m.mainW, "the content column keeps a usable width").toBeGreaterThanOrEqual(320);
  });
});
