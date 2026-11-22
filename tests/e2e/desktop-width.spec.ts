// Desktop-width geometry (§12.13 S4 criterion ③, the W57 method: measure, don't
// screenshot). The phone lane answers "does it fit in 390px"; this one answers
// the other end — at 1440 and 1920 the room must not collapse to a narrow column
// and its two columns must not overlap, which is the failure mode a grid
// regression produces silently on a wide screen.
//
// Geometry only, no baselines: the visual lane already owns "looks unchanged",
// and a wide-screen baseline would be a fourth image pair to re-bless.
import { test, expect, type Page } from "@playwright/test";
import { loginAs } from "../helpers";

type Rect = { left: number; right: number; top: number; bottom: number; width: number; height: number };

/**
 * Measure the page's content boxes. Same content filter as the phone lane: a
 * decorative aria-hidden blob may hang off the edge, text may not.
 */
async function measure(page: Page) {
  return page.evaluate(() => {
    const vw = window.innerWidth;
    const isContent = (el: Element) => {
      if (el.getAttribute("aria-hidden") === "true") return false;
      if (el.hasAttribute("data-sonner-toaster")) return false;
      const tag = el.tagName.toLowerCase();
      if (["button", "a", "input", "select", "textarea", "label"].includes(tag)) return true;
      return ((el as HTMLElement).innerText ?? "").trim().length > 0;
    };
    const rect = (el: Element) => {
      const r = el.getBoundingClientRect();
      return { left: r.left, right: r.right, top: r.top, bottom: r.bottom, width: r.width, height: r.height };
    };
    const content = Array.from(document.querySelectorAll("body *")).filter(isContent);
    const boxes = content.map((el) => ({ el, r: rect(el) }));
    const widest = boxes.reduce((a, b) => (b.r.right > a ? b.r.right : a), 0);
    const offenders = boxes
      .filter(({ r }) => r.right > vw + 1 && r.width > 0)
      .sort((a, b) => b.r.right - a.r.right)
      .slice(0, 3)
      .map(({ el, r }) => `${el.tagName.toLowerCase()}.${String((el as HTMLElement).className).slice(0, 40)} @${Math.round(r.right)}`);
    // Named regions the room's grid must keep apart, found by role rather than
    // by class so a styling refactor does not silently empty this list.
    const log = document.querySelector('[role="log"]');
    return {
      vw,
      vh: window.innerHeight,
      docScrollW: document.documentElement.scrollWidth,
      docScrollH: document.documentElement.scrollHeight,
      widest,
      offenders,
      main: (() => { const m = document.querySelector("main"); return m ? rect(m) : null; })(),
      transcript: log ? rect(log) : null,
    };
  });
}

/** Two boxes overlap when their intersection has area. Touching edges are fine. */
function overlaps(a: Rect, b: Rect, tolerance = 2): boolean {
  const x = Math.min(a.right, b.right) - Math.max(a.left, b.left);
  const y = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
  return x > tolerance && y > tolerance;
}

async function assertNoOverflow(page: Page, route: string) {
  const m = await measure(page);
  expect(m.docScrollW, `no horizontal scroll on ${route} at ${m.vw}px`).toBeLessThanOrEqual(m.vw + 1);
  expect(m.widest, "something was actually rendered and measured").toBeGreaterThan(200);
  expect(
    m.widest,
    `nothing reaches past the viewport on ${route} at ${m.vw}px: ${m.offenders.join(" | ")}`,
  ).toBeLessThanOrEqual(m.vw + 1);
  return m;
}

test.describe("desktop geometry", () => {
  test("/dashboard keeps a real content column, not a phone column centred", async ({ page }) => {
    test.slow();
    await loginAs(page);
    await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
    // A shell with a nav and a skeleton also has non-empty text; the measured
    // widest box was 143px on CI for exactly that reason. Wait for the board's
    // own landmark, then measure.
    await expect(page.locator("main")).toBeVisible({ timeout: 20000 });

    const m = await assertNoOverflow(page, "/dashboard");
    expect(m.main, "the dashboard renders a <main>").not.toBeNull();
    // A collapse shows up as a main column that shrank to a phone's width while
    // the viewport is three times wider. Half the viewport is a floor no real
    // desktop layout can respect and fail.
    expect(m.main!.width, `dashboard main collapsed at ${m.vw}px`).toBeGreaterThan(m.vw * 0.5);
  });

  test("/setup keeps its content inside the viewport and full width", async ({ page }) => {
    await loginAs(page);
    await page.goto("/setup", { waitUntil: "domcontentloaded" });
    // The wizard is a sequence of cards, not a <main>: wait for the first card's
    // heading, which only exists once the client has mounted the step.
    await expect(page.getByText("Frontend Engineer").first()).toBeVisible({ timeout: 20000 });

    const m = await assertNoOverflow(page, "/setup");
    // Half-width floor on the widest content box: a wizard column centred in
    // a 1440 viewport at 390px would be the collapse this looks for.
    expect(m.widest, `setup content collapsed at ${m.vw}px`).toBeGreaterThan(m.vw * 0.5);
  });

  test("/interview keeps two real columns without overlap", async ({ page }) => {
    test.slow();
    await loginAs(page);
    // testMode=true is the page's own switch for the green-room gate
    // (`isGreenRoom = !testMode`), so the room itself renders and the two
    // columns can be measured. Without it the gate stands in front and the
    // composer never mounts.
    await page.goto("/interview?id=e2e-desktop-width&testMode=true", { waitUntil: "domcontentloaded" });
    await expect(page.getByPlaceholder("输入文本...")).toBeVisible({ timeout: 30000 });

    const m = await assertNoOverflow(page, "/interview");
    expect(m.transcript, "the room renders its transcript log").not.toBeNull();

    // The stage column and the transcript column share a 12-column grid at lg+.
    // Squeezing the stage below a third of the viewport is the collapse W53/W56
    // fixed; letting the two columns intersect is the other regression.
    const composer = page.getByPlaceholder("输入文本...");
    const composerBox = (await composer.boundingBox()) as Rect | null;
    expect(composerBox, "the composer has a measurable box").not.toBeNull();

    const transcript = m.transcript!;
    expect(
      overlaps(composerBox!, transcript),
      `stage composer overlaps the transcript at ${m.vw}px (composer right=${Math.round(composerBox!.right)}, transcript left=${Math.round(transcript.left)})`,
    ).toBe(false);

    if (m.vw >= 1024) {
      // Above the lg breakpoint the transcript sits in the right column, so the
      // composer must end before it starts.
      expect(
        composerBox!.right,
        `stage column ran into the transcript column at ${m.vw}px`,
      ).toBeLessThanOrEqual(transcript.left + 1);
    }
  });
});
