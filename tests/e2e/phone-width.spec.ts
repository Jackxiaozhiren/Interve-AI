// Phone-width geometry. The rank-1 audience opens this on a phone, and until
// this file existed no project in playwright.config.ts used a phone viewport at
// all — every lane was a desktop window at three widths, so "works on mobile"
// was an assumption rather than a reading.
//
// These are geometry assertions, not screenshots: a baseline image only says the
// page looks the same as last time, while these say the content column is wide
// enough to read and that nothing pushes the document sideways.
import { test, expect, type Page } from "@playwright/test";
import { createPostgrestStub, loginAs, openSettleFailureRoom, seedSupabaseSession } from "../helpers";

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
      // Sonner's toaster is a transparent, fixed 390px positioning <ol>: at a
      // 390px viewport it starts at 16 and ends at 406. The visible <li> card
      // inside is 358px wide with 16px on either side. Counting the container
      // reports a clipped notification the candidate never sees; the card is
      // measured on its own instead.
      if (el.hasAttribute("data-sonner-toaster")) return false;
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

/**
 * Render one real V2 report through the PostgREST stub and leave the page on it.
 * Every phone-width report assertion uses this same row, so the first-screen and
 * body readings cannot drift into measuring two different fixtures. Three
 * dimensions, a roadmap and a four-turn transcript are the minimum that makes
 * the radar, the dimension cards and the transcript bubbles all render.
 */
async function openReportAtPhoneWidth(page: Page): Promise<void> {
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
        title: "Phone layout report",
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
  // A condition, not a clock: `waitForTimeout` was rejected by the sleep-class
  // guard, and waiting for the measurement target is the better wait anyway.
  await expect(page.getByRole("region", { name: /本次最该改的三件事/ })).toBeVisible({ timeout: 30000 });
}

/**
 * Walk the six-step wizard up to the Hardware Check gate on the phone lane.
 * The 390px journey and the weak-network probe both need a real session
 * configuration; two copies of the same clicks let them drift, and the quality
 * gate read them as 20 duplicated lines. `onReady` lets the journey measure the
 * freshly rendered first step before the first click moves the page.
 */
async function walkSetupToHardware(
  page: Page,
  resumeMarker: string,
  onReady?: () => Promise<unknown>,
): Promise<void> {
  await page.goto("/setup", { waitUntil: "domcontentloaded" });
  // The heading is server-rendered; waiting for the client to settle is what
  // makes the first Next click land on a button with its handler attached.
  await page.waitForLoadState("networkidle");
  if (onReady) await onReady();

  for (const choices of [
    ["Frontend Engineer", "Mid-Level"],
    ["General Tech"],
    ["Supportive Mentor"],
    ["Google Gemini (1.5 Pro)"],
  ]) {
    for (const choice of choices) await page.getByText(choice).click();
    await page.getByRole("button", { name: /Next Step/i }).click();
  }

  await expect(page.getByRole("heading", { name: "Resume Integration" })).toBeVisible({ timeout: 20000 });
  await page.locator("#resume-upload").setInputFiles({
    name: "resume.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from(`%PDF-1.4 ${resumeMarker}\n%%EOF`),
  });
  await expect(page.getByText(/chars extracted/)).toBeVisible({ timeout: 30000 });
  await page.getByPlaceholder(/Paste job description/).fill("Senior Frontend Engineer. React and TypeScript.");
  await page.getByRole("button", { name: /Next Step/i }).click();
  await expect(page.getByRole("heading", { name: "Hardware Check" })).toBeVisible({ timeout: 20000 });
}

/**
 * The standing local-only confirmation is one contract. A database that is
 * down and a demo login with no owning account differ only in which toast
 * acknowledges the failure and which reason the alert must state; everything
 * after that — no silent room, assertive live region, 44px exits, consent
 * before navigation — is the same assertion, so it lives here once.
 */
async function expectLocalOnlyConsent(
  page: Page,
  options: Readonly<{ toast: string; reason: RegExp }>,
): Promise<void> {
  const banner = page.getByRole("alert").filter({ hasText: "本次面试无法保存" });
  await expect(banner, "a session that cannot be saved is stated before the room").toBeVisible({ timeout: 20000 });
  await expect(page, "the room does not open behind the candidate's back").toHaveURL(/\/setup/);
  await expect(banner).toHaveAttribute("aria-live", "assertive");
  await expect(banner.getByText(options.reason)).toBeVisible();
  // Sonner pauses a toast's timer while the pointer rests on it. The Start
  // Session button sits at the bottom of step 6, exactly where the bottom
  // acknowledgement appears, so move away before waiting for it to expire.
  await page.mouse.move(0, 0);
  await expect(page.locator("[data-sonner-toaster] li").filter({ hasText: options.toast })).toHaveCount(0, {
    timeout: 20000,
  });
  await expect(banner, "the explanation outlives the toast").toBeVisible();
  const retry = banner.getByRole("button", { name: /重试连接/ });
  const proceed = banner.getByRole("button", { name: /仍要继续/ });
  for (const [name, control] of [
    ["retry", retry],
    ["proceed", proceed],
  ] as const) {
    const box = await control.boundingBox();
    expect(Math.round(box?.height ?? 0), `${name} is at least 44px tall`).toBeGreaterThanOrEqual(44);
  }
  await proceed.click();
  await expect(page).toHaveURL(/\/interview/, { timeout: 30000 });
}

/**
 * Shared phone geometry reader. A link at right=759 inside the sidebar's
 * horizontal strip is reachable by swiping; a badge at right=476 inside an
 * `overflow-hidden` card is gone for good. The scroller test keeps those apart,
 * so "nothing past the edge" can be asserted without forbidding the strip.
 *
 * `titleW` / `dateH` are the console's session-row readings and are zero on
 * surfaces without a session card; callers assert only the fields their surface
 * owns.
 */
const readPhoneGeometry = (page: Page) =>
  page.evaluate(() => {
    const vw = window.innerWidth;
    const round = (n: number) => Math.round(n);
    const isContent = (el: Element) => {
      if (el.getAttribute("aria-hidden") === "true") return false;
      // Sonner's toaster is a transparent, fixed 390px positioning <ol>: at a
      // 390px viewport it starts at 16 and ends at 406. The visible <li> card
      // inside is 358px wide with 16px on either side. Counting the container
      // reports a clipped notification the candidate never sees; the card is
      // measured on its own instead.
      if (el.hasAttribute("data-sonner-toaster")) return false;
      const tag = el.tagName.toLowerCase();
      if (["button", "a", "input", "select", "textarea", "label"].includes(tag)) return true;
      return ((el as HTMLElement).innerText ?? "").trim().length > 0;
    };
    const inScroller = (el: Element) => {
      let p: Element | null = el.parentElement;
      while (p && p !== document.body) {
        const cs = getComputedStyle(p);
        if ((cs.overflowX === "auto" || cs.overflowX === "scroll") && p.scrollWidth > p.clientWidth + 1) return true;
        p = p.parentElement;
      }
      return false;
    };
    const clipped = Array.from(document.querySelectorAll("body *"))
      .filter(isContent)
      .filter((el) => !inScroller(el))
      .map((el) => ({ el, r: el.getBoundingClientRect() }))
      .filter(({ r }) => r.right > vw + 1 && r.width > 0)
      .sort((a, b) => b.r.right - a.r.right)
      .slice(0, 8)
      .map(({ el, r }) => `${el.tagName.toLowerCase()}.${String((el as HTMLElement).className).slice(0, 60)} right=${round(r.right)}`);
    const card = document.querySelector("[aria-label^='查看面试详情']");
    const title = card?.querySelector("h3") ?? null;
    const date = card
      ? Array.from(card.querySelectorAll("span")).find((el) =>
          /^\d{4}-\d{2}-\d{2}/.test((el as HTMLElement).innerText?.trim() ?? ""),
        ) ?? null
      : null;
    const small = Array.from(document.querySelectorAll("main button, main a[href]"))
      .map((el) => ({ el, r: el.getBoundingClientRect() }))
      // Layout can leave a 44px control at 43.98px; comparing the rounded
      // value keeps a sub-pixel rounding from reading as a too-small target.
      .filter(({ r }) => r.width > 0 && r.height > 0 && round(r.height) < 44)
      .slice(0, 12)
      .map(({ el, r }) => `${el.tagName.toLowerCase()} "${(el as HTMLElement).innerText?.trim().slice(0, 22) || el.getAttribute("aria-label") || ""}" ${round(r.width)}x${round(r.height)}`);
    return {
      vw,
      visual: round(window.visualViewport?.width ?? 0),
      docScroll: document.documentElement.scrollWidth,
      clipped,
      titleW: title ? round(title.getBoundingClientRect().width) : 0,
      dateH: date ? round(date.getBoundingClientRect().height) : 0,
      small,
    };
  });

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
    await openReportAtPhoneWidth(page);

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

  // Below the first screen, `docScroll` stayed at 390 and no lane was red, yet
  // the page nested its own `px-6` inside the shell's `p-5`: every card sat in a
  // 302px column and dimension cards were 236px wide. The radar SVG also clipped
  // two of three axis labels (`star_completeness` 49px past its right edge),
  // because `svg:not(:root)` is `overflow: hidden` by the UA stylesheet.
  test("the report body keeps a usable column and intact radar labels", async ({ page }) => {
    test.setTimeout(180000);
    await openReportAtPhoneWidth(page);

    const shared = await readPhoneGeometry(page);
    expect(shared.visual, "the lane really is 390 CSS px wide").toBe(390);
    expect(shared.clipped, "no content is clipped past the right edge").toEqual([]);
    expect(shared.docScroll, "no horizontal scroll").toBeLessThanOrEqual(shared.vw + 1);

    const m = await page.evaluate(() => {
      const vw = window.innerWidth;
      const round = (n: number) => Math.round(n);
      const sectionOf = (text: string) => {
        const h = Array.from(document.querySelectorAll("h2, h3")).find((el) => el.textContent?.includes(text)) ?? null;
        let p: Element | null = h;
        while (p && !String((p as HTMLElement).className).includes("rounded-[2rem]")) p = p.parentElement;
        return p;
      };
      const column = sectionOf("下一步练什么");
      const dimensions = sectionOf("能力维度评估");
      const dimCard = dimensions
        ? Array.from(dimensions.querySelectorAll("[class*='rounded-2xl']"))[0] ?? null
        : null;
      const radarSvg = document.querySelector(".recharts-surface");
      const ticks = Array.from(document.querySelectorAll(".recharts-surface text")).map((el) => {
        const r = el.getBoundingClientRect();
        return { t: el.textContent ?? "", left: round(r.left), right: round(r.right) };
      });
      return {
        vw,
        columnW: column ? round(column.getBoundingClientRect().width) : 0,
        dimensionW: dimCard ? round(dimCard.getBoundingClientRect().width) : 0,
        ticksPastViewport: ticks
          .filter((t) => t.left < -1 || t.right > vw + 1)
          .map((t) => `"${t.t}" ${t.left}..${t.right}`),
        // Reading the computed style is the difference between "the text node
        // exists" and "the candidate can actually read it": an axis tick drawn
        // past the viewBox is silently cut even when it is inside the viewport.
        svgOverflow: radarSvg ? getComputedStyle(radarSvg).overflow : "missing",
        tickCount: ticks.length,
      };
    });

    // Soft assertions: a geometry regression usually moves several readings at
    // once, and stopping at the first one hides the shape of the break.
    expect.soft(m.tickCount, "the radar actually rendered its axes").toBeGreaterThan(0);
    expect.soft(m.columnW, "the report column uses the phone width, not 302px").toBeGreaterThanOrEqual(340);
    expect.soft(m.dimensionW, "dimension cards keep a readable width").toBeGreaterThanOrEqual(270);
    expect.soft(m.ticksPastViewport, "radar labels stay inside the viewport").toEqual([]);
    expect.soft(m.svgOverflow, "the radar SVG does not clip its axis labels").toBe("visible");
  });
});

// The wizard is the only door into an interview, and its Next button sits at the
// bottom of a long step. At 390px the page kept the previous step's scroll
// offset: pressing Next on step 1 left the document at scrollY≈410, so step 2
// opened with its own heading above the viewport. "Six steps all render" never
// catches that; the reading that does is where the new step's heading lands.
test.describe("setup at phone width", () => {
  test("advancing a step opens at the new step, not mid-page", async ({ page }) => {
    test.setTimeout(240000);
    await loginAs(page);
    await page.goto("/setup", { waitUntil: "domcontentloaded" });
    // `Target Role` is server-rendered, so its presence does not mean the Next
    // button has a handler yet. In a busy dev server (other projects compiling in
    // parallel) an early click lands on the inert HTML and the route falls back
    // to app/loading.tsx, which reads as "step 2 never opened". The desktop
    // setup spec waits for networkidle for exactly this reason.
    await page.waitForLoadState("networkidle");
    await expect(page.getByRole("heading", { name: "Target Role" })).toBeVisible({ timeout: 30000 });

    const shared = await readPhoneGeometry(page);
    expect(shared.visual, "the lane really is 390 CSS px wide").toBe(390);
    expect(shared.clipped, "no content is clipped past the right edge").toEqual([]);
    expect(shared.docScroll, "no horizontal scroll").toBeLessThanOrEqual(shared.vw + 1);

    const headings = [
      "Target Role",
      "Target Company",
      "Interviewer Persona",
      "AI Model Engine",
      "Resume Integration",
      "Hardware Check",
    ];
    for (let step = 1; step < headings.length; step++) {
      await page.getByRole("button", { name: /Next Step/i }).click();
      await expect(page.getByRole("heading", { name: headings[step], exact: true }).first()).toBeVisible({ timeout: 20000 });
      // AnimatePresence keeps the outgoing step mounted through its exit; waiting
      // for its heading to disappear is the condition that says the swap is done.
      await expect(page.getByRole("heading", { name: headings[step - 1], exact: true })).toHaveCount(0, {
        timeout: 20000,
      });

      const m = await page.evaluate((text) => {
        const h = Array.from(document.querySelectorAll("h2")).find((el) => (el.textContent ?? "").trim() === text);
        const r = h?.getBoundingClientRect();
        return { top: r ? Math.round(r.top) : -9999, scrollY: Math.round(window.scrollY) };
      }, headings[step]);

      // 0 is the top edge; the second bound says the whole title is inside an
      // 844px first screen rather than half-scrolled under it.
      expect.soft(m.top, `step ${step + 1} opens with its heading at ${m.top}px (scrollY ${m.scrollY})`).toBeGreaterThanOrEqual(0);
      expect.soft(m.top, `step ${step + 1}'s heading is inside the first screen`).toBeLessThan(844);
    }
  });
});

// The console's session rows and the settings controls were the last two
// dashboard surfaces no phone lane measured. Both kept `scrollWidth <= innerWidth`,
// which is why the desktop lanes stayed green: the row clipped its own metadata
// inside `overflow-hidden`, and the settings buttons were simply short. Neither
// defect is visible to a "no horizontal scrollbar" assertion.
test.describe("dashboard surfaces at phone width", () => {
  /** Two scored sessions: the readiness badge only renders with a V2 evaluation. */
  const seedSessions = async (page: Page) => {
    await page.route("**/rest/v1/*", createPostgrestStub());
    const uid = await seedSupabaseSession(page);
    await loginAs(page);
    await page.evaluate(async ({ owner }) => {
      for (let i = 0; i < 2; i++) {
        await fetch("https://placeholder.supabase.co/rest/v1/interviews", {
          method: "POST",
          headers: { "content-type": "application/json", prefer: "return=representation" },
          body: JSON.stringify({
            title: `Phone session ${i + 1}`,
            status: "completed",
            createdAt: new Date(Date.parse("2026-10-01T00:00:00Z") + i * 86400000).toISOString(),
            updatedAt: new Date(Date.parse("2026-10-01T00:00:00Z") + i * 86400000).toISOString(),
            user_id: owner,
            evaluationV2: {
              version: "2.0", rubricId: "general-v1", readiness: "developing", readinessRationale: "probe",
              dimensions: [{ id: "clarity", score: 3 + i, evidence: ["x"], rationale: "r", confidence: "high", improvement: "i" }],
              strengths: ["s"], weaknesses: ["w"], nextDrills: ["d"], qaReview: [],
            },
          }),
        });
      }
    }, { owner: uid });
  };

  test("session rows keep their metadata inside the viewport", async ({ page }) => {
    test.setTimeout(180000);
    await seedSessions(page);
    await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
    await expect(page.getByText("Average Score", { exact: true })).toBeVisible({ timeout: 30000 });

    const m = await readPhoneGeometry(page);
    expect(m.visual, "the lane really is 390 CSS px wide").toBe(390);
    // Before the fix both rows clipped their readiness badge at right=476, and
    // the title column had 87px left after a 96px score circle and 32px gutters.
    expect(m.clipped, "no content is clipped past the right edge").toEqual([]);
    expect(m.titleW, "the session title keeps a readable column").toBeGreaterThanOrEqual(170);
    expect(m.dateH, "the timestamp stays on one line").toBeLessThanOrEqual(28);
    expect(m.docScroll, "no horizontal scroll").toBeLessThanOrEqual(m.vw + 1);
  });

  test("settings controls are large enough to press", async ({ page }) => {
    test.setTimeout(180000);
    await loginAs(page);
    await page.goto("/dashboard/settings", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible({ timeout: 30000 });

    const m = await readPhoneGeometry(page);
    // `size="sm"` is 32px and the default is 36px; on a touch screen the
    // language, four preference and sign-out controls were all below 44px.
    expect(m.small, "every control in the page body is at least 44px tall").toEqual([]);
    expect(m.clipped, "no content is clipped past the right edge").toEqual([]);
    expect(m.docScroll, "no horizontal scroll").toBeLessThanOrEqual(m.vw + 1);

    // Enlarging a button must not cost it its behaviour.
    const language = page.locator("main [role='group'] button");
    await expect(language).toHaveCount(2);
    await language.nth(1).click();
    await expect(language.nth(1)).toHaveAttribute("aria-pressed", "true");
  });
});

// The desktop mock journey proves the wiring chain, but the phone project only
// collects this file. Leaving setup, entering the room, answering and landing on
// the report were therefore four hand-offs no lane crossed in one pass — and a
// page-by-page geometry check cannot see a broken hand-off, because each page
// still measures fine on its own.
test.describe("phone journey at 390px", () => {
  // E2E_MOCK boots the dev server with AI_MOCK=1, so finishing an interview
  // produces a deterministic evaluation without provider keys.
  test.skip(!process.env.E2E_MOCK, "needs E2E_MOCK=1 (mock AI + stubbed DB)");

  test("setup → interview → answer → report all work at 390px", async ({ page }) => {
    test.setTimeout(300000);
    await page.route("**/rest/v1/*", createPostgrestStub());
    const uid = await seedSupabaseSession(page);
    await loginAs(page, "journey@example.com", uid);

    // `visual`, not innerWidth, is what catches a widened layout viewport being
    // scaled down to fit 390 — every innerWidth assertion would still pass.
    const atPhoneWidth = async (label: string) => {
      const m = await readPhoneGeometry(page);
      expect(m.visual, `${label}: the lane is really 390 CSS px wide`).toBe(390);
      expect(m.docScroll, `${label}: no horizontal scroll`).toBeLessThanOrEqual(m.vw + 1);
      expect(m.clipped, `${label}: nothing is clipped past the right edge`).toEqual([]);
      return m;
    };

    await walkSetupToHardware(page, "phone journey resume", () => atPhoneWidth("setup"));
    await atPhoneWidth("setup hardware step");

    await page.getByRole("button", { name: /Start Session|Start without Mic/i }).click();
    await expect(page).toHaveURL(/.*\/interview/, { timeout: 30000 });

    const bypass = page.getByRole("button", { name: /跳过语音测试/i });
    await expect(bypass).toBeVisible({ timeout: 20000 });
    await bypass.click();
    const enter = page.getByRole("button", { name: /开始面试|强制开始/i });
    await expect(enter).toBeEnabled({ timeout: 35000 });
    await enter.click();
    await expect(page.getByRole("button", { name: /结束面试/i })).toBeVisible({ timeout: 20000 });
    await atPhoneWidth("interview room");

    const composer = page.getByPlaceholder("输入文本...");
    await expect(composer).toBeVisible({ timeout: 20000 });
    await composer.fill("手机端完整旅程回答");
    await page.getByRole("button", { name: /发送消息/ }).click();
    await expect(page.getByRole("log").getByText(/Mock interviewer/)).toBeVisible({ timeout: 60000 });

    await page.getByRole("button", { name: /结束面试/i }).click();
    await expect(page).toHaveURL(/.*\/dashboard\/report\/\d+/, { timeout: 90000 });
    // A URL alone is not a report: the improvements section is the payload the
    // candidate came for, and it must be reachable at this width too.
    await expect(page.getByRole("region", { name: /本次最该改的三件事/ })).toBeVisible({ timeout: 30000 });
    const report = await atPhoneWidth("report");
    expect(report.small, "report controls are at least 44px tall").toEqual([]);
  });
});

// The console, the report and the wizard each got a phone pass; these three
// surfaces did not. A replay is where a candidate re-reads what they said, the
// practice list is where they act on it, and the privacy page is where they
// delete data — all three are reached from the same 390px screen.
test.describe("secondary surfaces at phone width", () => {
  test("replay, practice and privacy fit, and every control is pressable", async ({ page }) => {
    test.setTimeout(240000);
    await openReportAtPhoneWidth(page);
    const reportId = page.url().match(/report\/(\d+)/)?.[1];
    expect(reportId, "the fixture report exists").toBeTruthy();

    const surfaces = [
      ["replay", `/dashboard/replay/${reportId}`, "Transcript"],
      ["practice", "/practice", "Master the Interview"],
      ["privacy", "/dashboard/privacy", "Privacy Center"],
    ] as const;

    for (const [label, path, heading] of surfaces) {
      await page.goto(path, { waitUntil: "domcontentloaded" });
      await page.waitForLoadState("networkidle");
      await expect(page.getByRole("heading", { name: heading, exact: false }).first()).toBeVisible({ timeout: 30000 });

      const m = await readPhoneGeometry(page);
      expect(m.visual, `${label}: the lane is really 390 CSS px wide`).toBe(390);
      expect(m.docScroll, `${label}: no horizontal scroll`).toBeLessThanOrEqual(m.vw + 1);
      expect(m.clipped, `${label}: nothing is clipped past the right edge`).toEqual([]);
      expect(m.small, `${label}: every control is at least 44px tall`).toEqual([]);

      // A heading whose content is wider than its box is a squeezed title, not
      // a short one: replay's measured 112px for a 19-character title before the
      // header was allowed to wrap. Hidden panels carry 0-width h1 clones, so
      // only rendered ones count.
      const squeezed = await page.evaluate(() =>
        Array.from(document.querySelectorAll("h1"))
          .map((el) => {
            const r = el.getBoundingClientRect();
            return {
              text: (el.textContent ?? "").trim().slice(0, 24),
              scroll: el.scrollWidth,
              client: el.clientWidth,
              width: Math.round(r.width),
            };
          })
          .filter((h) => h.width > 0 && h.scroll > h.client + 1),
      );
      expect(squeezed, `${label}: no heading is squeezed below its own text`).toEqual([]);
    }
  });
});

// A dropped connection is the ordinary phone failure, and until this existed it
// was indistinguishable from a slow answer: at 390px with /api/interview-chat
// aborted the room showed zero role="alert" nodes, cleared the composer, and
// left one lonely user line in the transcript. The candidate waits for a reply
// that will never come, having lost the answer they typed.
test.describe("a dropped send at phone width", () => {
  test.skip(!process.env.E2E_MOCK, "needs E2E_MOCK=1 (mock AI + stubbed DB)");

  test("a failed send is stated, keeps the answer, and the retry reaches the interviewer", async ({ page }) => {
    test.setTimeout(180000);
    await loginAs(page);

    // One seam: the chat route is down until the test opens it again.
    let chatBlocked = true;
    await page.route("**/api/interview-chat", (route) => {
      if (chatBlocked) return route.abort("failed");
      return route.continue();
    });

    await page.goto("/interview?id=phone-send-failure&testMode=true");
    const enter = page.getByRole("button", { name: /开始面试|强制开始/i });
    await expect(enter).toBeEnabled({ timeout: 40000 });
    await enter.click();

    const composer = page.getByPlaceholder("输入文本...");
    await expect(composer).toBeVisible({ timeout: 20000 });
    await composer.fill("弱网下的一条回答");
    await page.getByRole("button", { name: /发送消息/ }).click();

    // 1. The failure is stated in words a candidate can act on, rather than
    //    looking like an answer that is merely slow.
    const banner = page.getByRole("alert").filter({ hasText: "这条回答没有发送成功" });
    await expect(banner, "a dropped send is stated on screen").toBeVisible({ timeout: 20000 });

    // 2. The answer is not lost with the request.
    await expect(composer, "the candidate's answer is back in the composer").toHaveValue("弱网下的一条回答");

    // 3. The way out is a real target at this width, not a 16px text link.
    const retry = banner.getByRole("button", { name: /重试发送/ });
    const box = await retry.boundingBox();
    expect(box, "the retry rendered without a box").not.toBeNull();
    expect(Math.round(box?.height ?? 0), "the retry is at least 44px tall").toBeGreaterThanOrEqual(44);

    // 4. Once the network is back, the retry reaches the interviewer, and the
    //    banner does not outlive the recovery.
    chatBlocked = false;
    await retry.click();
    await expect(page.getByRole("log").getByText(/Mock interviewer/)).toBeVisible({ timeout: 60000 });
    await expect(banner, "the banner disappears once the answer is delivered").toHaveCount(0);
  });

  // A turn whose SSE ends after half a sentence — no text-end, no finish, no
  // [DONE] — used to look like a complete question. The transport reports no
  // error (`isDisconnect:false`, `isError:false`), so nothing was stated, the
  // half question stayed in the transcript, and the candidate answered it as
  // if it were whole. Measured 2026-11-09: zero role="alert" nodes, the text
  // part still `state:"streaming"` at onFinish.
  test("a reply cut off mid-stream is stated and can be regenerated", async ({ page }) => {
    test.setTimeout(180000);
    await loginAs(page);

    let chatCalls = 0;
    await page.route("**/api/interview-chat", async (route) => {
      chatCalls += 1;
      if (chatCalls > 1) return route.continue();
      const frames = [
        { type: "start", messageId: "cut-1" },
        { type: "text-start", id: "cut-t1" },
        { type: "text-delta", id: "cut-t1", delta: "让我先问一个关于" },
      ];
      return route.fulfill({
        status: 200,
        headers: { "content-type": "text/event-stream", "cache-control": "no-cache" },
        body: frames.map((f) => `data: ${JSON.stringify(f)}\n\n`).join(""),
      });
    });

    await page.goto("/interview?id=phone-stream-cut&testMode=true");
    const enter = page.getByRole("button", { name: /开始面试|强制开始/i });
    await expect(enter).toBeEnabled({ timeout: 40000 });
    await enter.click();

    const composer = page.getByPlaceholder("输入文本...");
    await expect(composer).toBeVisible({ timeout: 20000 });
    await composer.fill("断开前的一条回答");
    await page.getByRole("button", { name: /发送消息/ }).click();

    // 1. Half a question is stated as a cut reply, not left as the question.
    const banner = page.getByRole("alert").filter({ hasText: "面试官的回答被截断了" });
    await expect(banner, "a stream that ended early is stated on screen").toBeVisible({ timeout: 30000 });

    // 2. The answer already reached the interviewer, so it must not be put back
    //    in the composer — that is what invites sending it twice.
    await expect(composer, "a delivered answer is not offered for re-sending").toHaveValue("");

    // 3. Both ways out are real targets at this width.
    for (const name of [/重新生成/, /先不管/]) {
      const box = await banner.getByRole("button", { name }).boundingBox();
      expect(Math.round(box?.height ?? 0), `${String(name)} is at least 44px tall`).toBeGreaterThanOrEqual(44);
    }

    // 4. Regenerating reaches the interviewer and clears the statement.
    await banner.getByRole("button", { name: /重新生成/ }).click();
    await expect(page.getByRole("log").getByText(/Mock interviewer/)).toBeVisible({ timeout: 60000 });
    await expect(banner, "the statement does not outlive the recovery").toHaveCount(0);
    expect(chatCalls, "the retry asked the route again").toBeGreaterThan(1);
  });
});

// A dropped database write at session start used to degrade silently: the
// wizard pushed into the room and the only explanation was a four-second
// Sonner toast. Measured at 390px with POST /rest/v1/interviews forced to 500:
// at +1.5s the toast read "本地模式 / 未连接数据库，本次面试仅保存在当前浏览器";
// at +7.5s `toasts=[]` and the room's only role="alert" was the microphone
// warning. A candidate who looked away for four seconds had no way to learn
// that the report, replay and history would not exist.
//
// The same probe found the settlement banner's two buttons at 76x32 and
// 212x32, and the green-room degradation exits at 260x16 / 260x17. All three
// sit outside `main`, which is why the shared geometry guard (main button,
// main a[href]) never measured them.
test.describe("weak-network failures at phone width", () => {
  test.skip(!process.env.E2E_MOCK, "needs E2E_MOCK=1 (mock AI + stubbed DB)");

  // The six wizard steps are the shared `walkSetupToHardware` above. The
  // failure probe needs the same configuration as the 390px journey, not a
  // second copy of the clicks.

  test("a session that cannot be saved is confirmed before the room opens", async ({ page }) => {
    test.setTimeout(240000);
    const stub = createPostgrestStub();
    await page.route("**/rest/v1/*", (route) => {
      const req = route.request();
      const table = new URL(req.url()).pathname.split("/").pop();
      if (table === "interviews" && req.method() === "POST") {
        return route.fulfill({
          status: 500,
          contentType: "application/json",
          body: JSON.stringify({ message: "simulated db down" }),
        });
      }
      return stub(route);
    });
    const uid = await seedSupabaseSession(page);
    await loginAs(page, "weakstart@example.com", uid);
    await walkSetupToHardware(page, "weak network resume");
    await page.getByRole("button", { name: /Start Session|Start without Mic/i }).click();

    await expectLocalOnlyConsent(page, { toast: "本地模式", reason: /未连接数据库/ });

    // The degradation exits on the green-room gate are pressable too.
    for (const name of [/跳过语音测试/, /先不面试，返回控制台/]) {
      const box = await page.getByRole("button", { name }).boundingBox();
      expect(Math.round(box?.height ?? 0), `green-room exit ${String(name)} is at least 44px tall`).toBeGreaterThanOrEqual(44);
    }
  });

  test("a demo login with no owning account is confirmed too, not just a down database", async ({ page }) => {
    test.setTimeout(240000);
    // No seedSupabaseSession(): stampOwner refuses the write with NO_OWNER before
    // any REST call goes out. The 390px browser check on 2026-11-09 found this
    // identity class still entering the room on a four-second toast, because the
    // standing confirmation was wired only to the "unreachable" branch.
    const stub = createPostgrestStub();
    await page.route("**/rest/v1/*", (route) => stub(route));
    await loginAs(page, "demo-consent@example.com");
    await walkSetupToHardware(page, "demo consent resume");
    await page.getByRole("button", { name: /Start Session|Start without Mic/i }).click();

    await expectLocalOnlyConsent(page, { toast: "本次面试不会保存", reason: /演示登录/ });
  });

  test("a report that cannot load still offers a phone-sized way out", async ({ page }) => {
    test.setTimeout(120000);
    // 390px browser check, 2026-11-09: /dashboard/report/<missing> renders the
    // shared ErrorState, whose "返回控制台" measured 36px at both phone and
    // desktop widths, and whose role=alert carried no explicit live region.
    const stub = createPostgrestStub();
    await page.route("**/rest/v1/*", (route) => stub(route));
    await loginAs(page);
    await page.goto("/dashboard/report/999999");
    const alert = page.getByRole("alert").filter({ hasText: "报告加载失败" });
    await expect(alert).toBeVisible({ timeout: 30000 });
    await expect(alert).toHaveAttribute("aria-live", "assertive");
    const back = alert.getByRole("button", { name: /返回控制台/ });
    const box = await back.boundingBox();
    expect(Math.round(box?.height ?? 0), "the way back is at least 44px tall").toBeGreaterThanOrEqual(44);
    const m = await readPhoneGeometry(page);
    expect(m.small, "the error state leaves no sub-44px control in main").toEqual([]);
  });

  test("a failed settle is retryable with phone-sized controls", async ({ page }) => {
    test.setTimeout(240000);
    // Same failure seam as the desktop P0-1 guard, so the phone lane cannot
    // drift into testing a different write failure.
    const { id, patchAttempts } = await openSettleFailureRoom(page, {
      email: "weaksave@example.com",
      title: "weak save probe",
    });
    await page.getByPlaceholder("输入文本...").fill("A measurable answer about a migration.");
    await page.getByRole("button", { name: /发送消息/ }).click();
    await expect(page.getByRole("log").getByText(/Mock interviewer/)).toBeVisible({ timeout: 60000 });
    await page.getByRole("button", { name: /结束面试/i }).click();

    const banner = page.getByRole("alert").filter({ hasText: "这次记录没有保存" });
    await expect(banner, "the failed write is stated on screen").toBeVisible({ timeout: 60000 });
    await expect(page, "the room stays put instead of faking a successful exit").toHaveURL(
      new RegExp(`/interview\\?id=${id}`),
    );

    // The banner is fixed outside `main`, so measure it directly rather than
    // through the shared guard that only looks inside the main landmark.
    for (const name of [/重试保存/, /返回控制台/]) {
      const box = await banner.getByRole("button", { name }).boundingBox();
      expect(Math.round(box?.height ?? 0), `${String(name)} is at least 44px tall`).toBeGreaterThanOrEqual(44);
    }
    const m = await readPhoneGeometry(page);
    expect(m.visual, "the lane is still 390 CSS px wide").toBe(390);
    expect(m.docScroll, "the standing banner adds no horizontal scroll").toBeLessThanOrEqual(m.vw + 1);

    // The retry is a real recovery at this width, not just a visible button.
    await banner.getByRole("button", { name: /重试保存/ }).click();
    await expect(page).toHaveURL(new RegExp(`/dashboard/report/${id}`), { timeout: 90000 });
    expect(patchAttempts(), "the retry attempted the write again").toBeGreaterThan(1);
  });
});
