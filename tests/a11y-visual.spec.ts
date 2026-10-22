// Phase 14: automated accessibility scans (axe-core) + visual regression.
// - axe: serious/critical violations fail the suite on public + key flows.
// - visual: landing hero + login card snapshots (animations disabled).
//   Snapshots live beside this file; regenerate deliberately via
//   `playwright test -u` after INTENTIONAL visual changes only.
import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { loginAs } from './helpers';

test.describe('Automated a11y scans', () => {
  /**
   * Wait until the page stops changing what a contrast check can see.
   *
   * axe samples the DOM once, and the room's status pill spends part of every
   * cycle near opacity 0.1 (measured mid-fade value: `0.10318`), so a scan taken
   * in that window reports the transition rather than the design. Waiting for
   * "no animations running" is not available: the same census counted
   * 14-26 animations in flight at every time slice (pulsing dots, an ambient 15 s
   * ring), so that predicate never settles and the previous `waitForTimeout(2500)`
   * was just a guess at where the cycle happened to be.
   *
   * Contrast depends on the opacity of the nodes that hold text, so this compares
   * that set 200 ms apart and requires it identical. Labels that are *deliberately*
   * translucent settle at once — two council titles sit at opacity 0.4 with no
   * animation and pass immediately, which is the point: the wait is about change,
   * not about translucency. When it does time out, the received value names the
   * moving node and its opacity, so the red says what to look at.
   */
  async function settleForScan(page: Page) {
    await expect
      .poll(
        () =>
          page.evaluate(
            () =>
              new Promise<string>((resolve) => {
                const read = () =>
                  Array.from(document.querySelectorAll('*'))
                    .filter((el) =>
                      Array.from(el.childNodes).some((n) => n.nodeType === 3 && (n.textContent ?? '').trim().length > 0),
                    )
                    .map((el) => `${getComputedStyle(el).opacity}|${(el.textContent ?? '').trim().slice(0, 12)}`)
                    .join(';');
                const before = read();
                setTimeout(() => {
                  const after = read();
                  resolve(before === after ? 'settled' : `moving: ${after.split(';').filter((s) => !before.split(';').includes(s)).join(' ')}`);
                }, 200);
              }),
          ),
        { timeout: 20000, message: 'the page kept changing the opacity of visible text' },
      )
      .toBe('settled');
  }

  /**
   * One scan for every arm, so a violation names its own nodes.
   *
   * The assertion is unchanged (serious/critical violations must be empty), but the
   * failure message now carries each violating selector: the earlier text printed
   * only `color-contrast: 2 nodes`, which left attribution as a guess.
   */
  async function expectNoSeriousViolations(page: Page) {
    const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
    const bad = results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
    expect(
      bad.map((v) => `${v.id}: ${v.nodes.length} nodes`),
      JSON.stringify(bad.map((v) => ({ id: v.id, targets: v.nodes.map((n) => n.target.join(' ')) }))),
    ).toEqual([]);
  }

  test('landing has no serious/critical axe violations', async ({ page }) => {
    await page.goto('/');
    await settleForScan(page);
    await expectNoSeriousViolations(page);
  });

  test('login has no serious/critical axe violations', async ({ page }) => {
    await page.goto('/login');
    await settleForScan(page);
    await expectNoSeriousViolations(page);
  });

  test('interview room has no serious/critical axe violations', async ({ page }) => {
    await loginAs(page);
    await page.goto('/interview?id=axe-room&testMode=true');
    const bypass = page.getByRole('button', { name: /跳过语音测试/i });
    if (await bypass.isVisible({ timeout: 5000 }).catch(() => false)) {
      await bypass.click();
    }
    const enter = page.getByRole('button', { name: /开始面试|强制开始/i });
    await expect(enter).toBeEnabled({ timeout: 35000 });
    await enter.click();
    await expect(page.getByRole('button', { name: /结束面试/i })).toBeVisible({ timeout: 15000 });
    // 11-probe convergence established that this arm's reds were scan timing, not
    // tokens: real nodes were fixed by darkening StatCard/pill/button/badge, and the
    // mid-fade frames were verified by those nodes disappearing from the report.
    await settleForScan(page);
    await expectNoSeriousViolations(page);
  });
});

test.describe('Visual regression', () => {
  /**
   * Next's dev overlay mounts into <nextjs-portal> and grows an "N · 1 Issue"
   * pill whenever the dev server logs anything — /login logs a hydration
   * warning today, and the pill alone is 3,735 px, nine times the diff budget.
   * Nothing like it exists in production, so masking keeps the snapshot
   * measuring the product rather than the harness.
   */
  const devChrome = (page: Page) => page.locator('nextjs-portal');

  /**
   * Prove the mask has something to mask, before letting a screenshot depend on it.
   *
   * Playwright's `mask` matches nothing *silently*. If Next renames or restructures
   * the dev-tools host, the mask stops hiding the indicator, the lane still passes,
   * and the next `-u` writes harness chrome straight back into the baseline. That is
   * not hypothetical: `login-main-chrome-1280x720-darwin.png` carried Next's "N"
   * badge in its bottom-left corner until PR #146 re-captured it, and the 925-pixel
   * surprise was found only because a human opened the diff image.
   *
   * Measured on this stack (`/login`, dev server): the indicator lives in a
   * `nextjs-portal` shadow host — `count(nextjs-portal) = 1`, `count(next-devtools)
   * = 0` — so the selector is right today. This assertion is what keeps "right today"
   * from becoming an untested assumption.
   */
  const expectChromeMaskable = async (page: Page) => {
    await expect(
      devChrome(page),
      'the dev-chrome mask matched no element: a screenshot taken now would capture Next\'s own indicator',
    ).toHaveCount(1);
  };

  test('landing hero matches snapshot', async ({ page }) => {
    await page.goto('/');
    await expectChromeMaskable(page);
    await expect(page.locator('main')).toHaveScreenshot('landing-main.png', {
      animations: 'disabled',
      maxDiffPixels: 400,
      mask: [devChrome(page)],
    });
  });

  test('login card matches snapshot', async ({ page }) => {
    await page.goto('/login');
    await expectChromeMaskable(page);
    // 'main, body' looks like a fallback but CSS matches in DOM order, so
    // .first() always won <body> and the "card" snapshot was the whole page.
    await expect(page.locator('main')).toHaveScreenshot('login-main.png', {
      animations: 'disabled',
      maxDiffPixels: 400,
      mask: [devChrome(page)],
    });
  });
});
