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

  // The rest of the core loop. These assert only that the document does not
  // scroll sideways: a page can be cramped and still be a page, but a page that
  // pushes itself wider than the screen hides controls off the right edge with no
  // way to reach them on a touch device.
  for (const route of ["/setup", "/interview"]) {
    test(`${route} does not scroll sideways at phone width`, async ({ page }) => {
      await loginAs(page);
      await page.goto(route);
      await page.waitForLoadState("domcontentloaded");

      // Measuring the wrong page is worse than not measuring: /interview without
      // a completed setup redirects, and a geometry assertion against the page it
      // lands on would report the setup wizard twice under two names.
      const landed = new URL(page.url()).pathname;
      test.skip(landed !== route, `redirected to ${landed} — the ${route} surface was not reached, so it is not measured`);

      const m = await page.evaluate(() => {
        const vw = window.innerWidth;
        // Decoration is allowed to hang off the edge: these pages paint blurred
        // ambient blobs (`w-[500px] h-[500px] bg-sky-300/30`) inside a clipped
        // root, and an empty aria-hidden div past the right edge hides nothing a
        // finger could reach. What may not overflow is *content*: text, controls,
        // and the things that carry them.
        const isContent = (el: Element) => {
          if (el.getAttribute("aria-hidden") === "true") return false;
          const tag = el.tagName.toLowerCase();
          if (["button", "a", "input", "select", "textarea", "label"].includes(tag)) return true;
          return ((el as HTMLElement).innerText ?? "").trim().length > 0;
        };
        const content = Array.from(document.querySelectorAll("body *")).filter(isContent);
        const past = content
          .map((el) => ({ el, r: el.getBoundingClientRect() }))
          .filter(({ r }) => r.right > vw + 1 && r.width > 0)
          .sort((a, b) => b.r.right - a.r.right)
          .slice(0, 3)
          .map(({ el, r }) => `${el.tagName.toLowerCase()}.${String((el as HTMLElement).className).slice(0, 50)} @${Math.round(r.right)}`);
        return {
          vw,
          docScroll: document.documentElement.scrollWidth,
          widest: content.reduce((a, el) => Math.max(a, el.getBoundingClientRect().right), 0),
          offenders: past,
        };
      });

      // `docScroll` alone is defeatable: a root with `overflow-hidden` clips the
      // overflow and produces no scrollbar, so a control pushed past the right
      // edge becomes unreachable while the document still measures clean. /setup
      // has exactly that root. The edge test below is immune to clipping.
      expect(m.docScroll, `no horizontal scroll on ${route}`).toBeLessThanOrEqual(m.vw + 1);
      expect(m.widest, `nothing reaches past the viewport on ${route}: ${m.offenders.join(" | ")}`).toBeLessThanOrEqual(m.vw + 1);
    });
  }
});
