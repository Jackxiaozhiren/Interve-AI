// Phone-width geometry. The rank-1 audience opens this on a phone, and until
// this file existed no project in playwright.config.ts used a phone viewport at
// all — every lane was a desktop window at three widths, so "works on mobile"
// was an assumption rather than a reading.
//
// These are geometry assertions, not screenshots: a baseline image only says the
// page looks the same as last time, while these say the content column is wide
// enough to read and that nothing pushes the document sideways.
import { test, expect, type Page } from "@playwright/test";
import { createPostgrestStub, loginAs, seedSupabaseSession } from "../helpers";

/**
 * The shared body for the two non-dashboard surfaces. Kept as a function rather
 * than a loop because the CI-lane guard reads literal `test(...)` calls — a
 * generated title is invisible to it, and an invisible test is one the inventory
 * cannot account for.
 */
async function assertSurfaceFits(page: Page, route: string, path: string): Promise<void> {
  await loginAs(page);
  await page.goto(path);
  await page.waitForLoadState("domcontentloaded");

  // Measuring the wrong page is worse than not measuring: a geometry assertion
  // against a page the route redirected to would report one surface twice.
  const landed = new URL(page.url()).pathname;
  console.log(`[phone-width] requested ${path}, landed ${landed}`);
  test.skip(landed !== route, `redirected to ${landed} — the ${route} surface was not reached, so it is not measured`);

  // An unrendered document measures 0 wide and satisfies every "does not exceed"
  // assertion, so wait until there is something to measure.
  await page.waitForFunction(() => document.body.innerText.trim().length > 0, undefined, { timeout: 15000 });

  const m = await page.evaluate(() => {
    const vw = window.innerWidth;
    // Decoration may hang off the edge: these pages paint blurred ambient blobs
    // (w-[500px] h-[500px] bg-sky-300/30) inside a clipped root, and an empty
    // aria-hidden div past the right edge hides nothing a finger could reach.
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

  // `docScroll` alone is defeatable: /setup's root carries `overflow-hidden`,
  // which clips the overflow and leaves no scrollbar. The edge test is immune.
  expect(m.docScroll, `no horizontal scroll on ${route}`).toBeLessThanOrEqual(m.vw + 1);
  expect(m.widest, "something was actually rendered and measured").toBeGreaterThan(120);
  expect(m.widest, `nothing reaches past the viewport on ${route}: ${m.offenders.join(" | ")}`).toBeLessThanOrEqual(m.vw + 1);
}

test.describe("phone width (390x844)", () => {
  test("the dashboard is laid out for a phone, not a shrunken desktop", async ({ page }) => {
    await loginAs(page);
    await page.goto("/dashboard");
    await page.waitForLoadState("domcontentloaded");

    // Measure after the shell mounts. Reading at domcontentloaded returned
    // `main` width 0 and failed on an unrendered page — and the same early read
    // would have let the other specs pass against an empty document, which is the
    // one failure mode a geometry assertion must never have.
    await page.waitForSelector("main");
    await page.waitForFunction(
      () => (document.querySelector("main")?.getBoundingClientRect().width ?? 0) > 0,
      undefined,
      { timeout: 15000 },
    );

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
  // scroll sideways: a page can be cramped and still be a page, but content
  // pushed past the right edge is unreachable on a touch device.
  //
  // /interview is not reachable without `?id=` — src/proxy.ts:74-79 redirects a
  // bare /interview to /setup as a preflight check. That is a URL requirement, not
  // a setup-state one, so the surface can be measured without seeding a session.
  test("/setup keeps its content inside a phone viewport", async ({ page }) => {
    await assertSurfaceFits(page, "/setup", "/setup");
  });

  test("/interview keeps its content inside a phone viewport", async ({ page }) => {
    await assertSurfaceFits(page, "/interview", "/interview?id=e2e-phone-width");
  });

  // Seven toggles in a single row needed 436px — wider than the phone — and the
  // menu is what replaced them. This asserts both halves of that trade: the bar
  // is short again, and every toggle it used to carry is still one press away.
  test("the room header fits a phone and keeps every toggle reachable", async ({ page }) => {
    test.slow();
    await loginAs(page);
    await page.goto("/interview?id=e2e-phone-header&testMode=true");

    // The standby card covers the bar until the interview starts; the toggles are
    // what a candidate reaches for mid-answer, so that is the state measured here.
    const enter = page.getByRole("button", { name: /开始面试|强制开始/i });
    await expect(enter).toBeEnabled({ timeout: 40000 });
    await enter.click();
    await expect(page.locator("header").first()).toBeVisible({ timeout: 20000 });

    const header = page.locator("header").first();
    const box = await header.boundingBox();
    expect(Math.round(box?.height ?? 0), "the bar no longer eats a sixth of the screen").toBeLessThanOrEqual(90);

    const more = page.getByRole("button", { name: "更多设置" });
    await expect(more).toHaveAttribute("aria-expanded", "false");
    await more.click();
    await expect(more).toHaveAttribute("aria-expanded", "true");

    const panel = page.locator("#room-more-toggles");
    await expect(panel).toBeVisible();
    // The seven descriptors render on both sides of the breakpoint; counting them
    // here is what stops one from going missing in the phone menu.
    await expect(panel.getByRole("button")).toHaveCount(7);

    const captions = panel.getByRole("button", { name: /开启实时字幕/ });
    await expect(captions).toHaveAttribute("aria-pressed", "false");
    await captions.click();
    await expect(panel.getByRole("button", { name: /关闭字幕/ })).toHaveAttribute("aria-pressed", "true");

    const widths = await page.evaluate(() => ({
      inner: window.innerWidth,
      visual: Math.round(window.visualViewport?.width ?? 0),
    }));
    expect(widths.visual).toBe(390);
    expect(widths.inner).toBeLessThanOrEqual(391);
  });

  // The claim behind "works on a phone" is not that the room paints, it is that a
  // candidate can answer. This is the journey the lane could not collect until the
  // stacking defect was fixed: the stage collapsed to 2px behind three stacked
  // telemetry cards, its dock floated up over the FlowMap, and the send button
  // resolved to whatever covered it. Asserting the message reaches the transcript
  // is the only reading that says the room advanced.
  test("the room can be advanced at phone width", async ({ page }) => {
    test.slow();
    await loginAs(page);
    await page.goto("/interview?id=e2e-phone-room&testMode=true");

    const enter = page.getByRole("button", { name: /开始面试|强制开始/i });
    await expect(enter).toBeEnabled({ timeout: 40000 });
    await enter.click();

    const composer = page.getByPlaceholder("输入文本...");
    await expect(composer).toBeVisible({ timeout: 20000 });
    await composer.fill("手机端回答");
    await page.getByRole("button", { name: /发送消息/ }).click();
    await expect(page.getByText("手机端回答")).toBeVisible({ timeout: 15000 });

    // And the width this ran at is the width the phone has. When the header's
    // control row could not wrap it forced a 528px layout viewport, which Chrome
    // then scaled to fit 390 — every geometry assertion above still passed,
    // because they compare against `innerWidth`, the widened number. The visual
    // viewport is the one the finger sees.
    const widths = await page.evaluate(() => ({
      inner: window.innerWidth,
      visual: Math.round(window.visualViewport?.width ?? 0),
    }));
    expect(widths.visual, "the lane really is 390 CSS px wide").toBe(390);
    expect(widths.inner, "nothing widened the layout viewport").toBeLessThanOrEqual(391);
  });
});

// The report is what a candidate screenshots for a mentor, and at 390px it used
// to open with 576px of dashboard navigation and a 124px-wide title — eight
// characters at 30px stacked into three lines beside a badge. These are the
// readings that made that visible, asserted so the next sidebar edit cannot
// quietly put them back.
test.describe("report at phone width", () => {
  test("the title is readable and the first improvements are in reach", async ({ page }) => {
    test.setTimeout(180000);
    await page.route("**/rest/v1/*", createPostgrestStub());
    const uid = await seedSupabaseSession(page);
    await loginAs(page, "report@example.com", uid);
    await page.goto("/dashboard", { waitUntil: "domcontentloaded" });

    const created = await page.evaluate(async () => {
      const quote =
        "那次优化我们主要做了路由懒加载和组件拆分，整体来说页面渲染的速度大概是快了一点点，具体没有做很精确的测量，但是从用户反馈来看体验是有提升的。";
      const res = await fetch("/rest/v1/interviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: "PROBE report",
          status: "completed",
          created_at: "2026-11-01T08:00:00.000Z",
          evaluation_v2: {
            version: "2.0",
            rubricId: "general-v1",
            readiness: "developing",
            readinessRationale:
              "这是一段用于测量布局的总评文字，长度接近真实报告的一段分析，用来观察在 390 像素宽度下的换行与卡片高度。",
            dimensions: [
              { id: "specificity", score: 2, evidence: [quote], rationale: "没有数字，听众无法判断量级。", confidence: "high", improvement: "重录第 2 题，把结果量化成一个数字。" },
              { id: "star_completeness", score: 3, evidence: [quote], rationale: "只说了职责，没有说任务与结果。", confidence: "medium", improvement: "补上 Result：项目上线后发生了什么。" },
              { id: "ownership", score: 4, evidence: [quote], rationale: "有主语，但决策过程没说清。", confidence: "high", improvement: "说清你做的那个决定，以及为什么。" },
            ],
            strengths: ["Fixture strength"],
            weaknesses: ["Fixture gap"],
            nextDrills: ["Fixture drill"],
            trainingRoadmap: {
              technical: ["路由懒加载与代码分割"],
              behavioral: ["用 STAR 说清结果"],
              resources: ["React 性能优化指南"],
            },
            qaReview: [],
          },
          transcript: [
            { id: "m1", role: "assistant", content: "先做个自我介绍吧。" },
            { id: "m2", role: "user", content: "我有三年 React 经验。" },
            { id: "m3", role: "assistant", content: "那次性能优化带来多少提升？" },
            { id: "m4", role: "user", content: quote },
          ],
        }),
      });
      return (await res.json()) as { id: number };
    });

    await page.goto(`/dashboard/report/${created.id}`, { waitUntil: "domcontentloaded" });
    await page.waitForSelector("main");
    // The block is the measurement target; waiting for it is a condition, not a
    // clock. `waitForTimeout` here was rejected by the sleep-class guard, and the
    // retrying assertion is the better wait anyway.
    await expect(page.getByRole("region", { name: /本次最该改的三件事/ })).toBeVisible({ timeout: 30000 });

    const m = await page.evaluate(() => {
      const vw = window.innerWidth;
      const round = (n: number) => Math.round(n);
      const box = (el: Element | null) => {
        if (!el) return null;
        const r = el.getBoundingClientRect();
        return { w: round(r.width), h: round(r.height), top: round(r.top), right: round(r.right) };
      };
      const isContent = (el: Element) => {
        if (el.getAttribute("aria-hidden") === "true") return false;
        const tag = el.tagName.toLowerCase();
        if (["button", "a", "input", "select", "textarea", "label"].includes(tag)) return true;
        return ((el as HTMLElement).innerText ?? "").trim().length > 0;
      };
      const past = Array.from(document.querySelectorAll("body *"))
        .filter(isContent)
        .map((el) => ({ el, r: el.getBoundingClientRect() }))
        .filter(({ r }) => r.right > vw + 1 && r.width > 0)
        .sort((a, b) => b.r.right - a.r.right)
        .slice(0, 8)
        .map(
          ({ el, r }) =>
            `${el.tagName.toLowerCase()}.${String((el as HTMLElement).className).slice(0, 70)} right=${round(r.right)} w=${round(r.width)}`,
        );
      const main = document.querySelector("main");
      const h1 = document.querySelector("h1");
      const landmarks = Array.from(document.querySelectorAll("nav, aside, main")).map((el) => ({
        tag: el.tagName.toLowerCase(),
        cls: String((el as HTMLElement).className).slice(0, 44),
        ...box(el),
      }));
      const chain: { tag: string; cls: string; w: number; h: number }[] = [];
      let node: Element | null = h1;
      while (node && node !== document.body) {
        const r = node.getBoundingClientRect();
        chain.push({
          tag: node.tagName.toLowerCase(),
          cls: String((node as HTMLElement).className).slice(0, 50),
          w: round(r.width),
          h: round(r.height),
        });
        node = node.parentElement;
      }
      const aside = document.querySelector("aside");
      const reportMain = document.querySelector("main.max-w-6xl");
      const h1Box = h1?.getBoundingClientRect();
      const improvements = document
        .querySelector("[aria-labelledby='top-improvements-heading']")
        ?.getBoundingClientRect();
      return {
        vw,
        visual: round(window.visualViewport?.width ?? 0),
        docScroll: document.documentElement.scrollWidth,
        asideH: aside ? round(aside.getBoundingClientRect().height) : 0,
        reportMainTop: reportMain ? round(reportMain.getBoundingClientRect().top) : 0,
        h1W: h1Box ? round(h1Box.width) : 0,
        h1H: h1Box ? round(h1Box.height) : 0,
        improvementsTop: improvements ? round(improvements.top) : 9999,
        landmarks,
        chain,
        main: main ? { ...box(main), padding: getComputedStyle(main).padding } : null,
        h1: h1 ? { size: getComputedStyle(h1).fontSize, ...box(h1) } : null,
        topBlock: box(document.querySelector("[aria-labelledby='top-improvements-heading']")),
        cards: Array.from(document.querySelectorAll("main [class*='rounded-']"))
          .slice(0, 14)
          .map((el) => {
            const cs = getComputedStyle(el);
            return { cls: String((el as HTMLElement).className).slice(0, 46), ...box(el), p: cs.padding };
          }),
        past,
      };
    });
    // 576px of navigation left the report below the fold; a phone-width shell
    // keeps the same five destinations in one scrollable row.
    expect(m.asideH, "the dashboard navigation no longer eats the first screen").toBeLessThanOrEqual(280);
    expect(m.reportMainTop, "the report starts near the top of the document").toBeLessThanOrEqual(400);

    // 124px was the measured width of the heading before the change: a badge and
    // a non-wrapping row split 302px between them, and eight characters at 30px
    // stacked into three lines.
    expect(m.h1W, "the heading uses the content width, not a 124px column").toBeGreaterThanOrEqual(250);
    expect(m.h1H, "the heading is one line, not three").toBeLessThanOrEqual(48);

    // The whole point of the page: what to change. A heading 1020px down is not a
    // first screen.
    const viewportHeight = page.viewportSize()?.height ?? 844;
    expect(m.improvementsTop, `the first improvements start at ${m.improvementsTop}px`).toBeLessThanOrEqual(viewportHeight);
    expect(m.docScroll, "nothing pushes the document sideways").toBeLessThanOrEqual(m.vw + 1);
  });
});
