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
   * Next's dev-tools host has to be out of the frame, and the lane has to know it is.
   *
   * It used to be *masked* (`mask: [locator('nextjs-portal')]`), which is wrong twice
   * over. A mask paints magenta over what it covers, so a mask that works leaves
   * harness pixels in the baseline. And a mask whose element has no painted box covers
   * nothing while still looking configured — which is what had actually happened: the
   * PR #147 CI run's two ubuntu captures contain **zero magenta pixels**, and they
   * differ from the committed baselines only in the bottom-left corner where the
   * indicator lives (landing: 4,334 px inside x[1..74] y[661..733], the collapsed "N"
   * badge; login: 9,064 px inside x[1..156] y[656..719], the expanded "N · 1 Issue ✕"
   * pill). The pill had been written into the product's visual truth, and the lane
   * kept passing against it because the baseline and the harness error changed
   * together — until a run where the error did not fire.
   *
   * Hiding the host is deterministic and leaves no mask artefact. The two assertions
   * after it are what make the hide load-bearing instead of decorative: the first
   * fails if Next renames the host (nothing to hide), the second if the rule stops
   * applying (hidden on paper, painted in the frame). Measured mechanism, on a
   * synthetic `:host{all:initial}` shadow element painting a fixed pill from a
   * document stylesheet: 2,236 pill pixels before the rule, 0 after.
   */
  const DEV_CHROME_HOST = 'nextjs-portal';

  const hideDevChrome = async (page: Page) => {
    await page.addStyleTag({ content: `${DEV_CHROME_HOST}{display:none !important}` });
    const portal = page.locator(DEV_CHROME_HOST);
    await expect(
      portal,
      `Next's dev-tools host is not mounted as <${DEV_CHROME_HOST}>: this lane has nothing to hide, ` +
        'and a screenshot taken now would capture whatever the indicator paints',
    ).toHaveCount(1);
    await expect
      .poll(() => portal.evaluate((el) => getComputedStyle(el).display), {
        message:
          `the dev-tools host is still painted: <${DEV_CHROME_HOST}> is visible to layout, so the ` +
          'snapshot would capture Next\'s own indicator instead of the product',
      })
      .toBe('none');
  };

  test('landing hero matches snapshot', async ({ page }) => {
    await page.goto('/');
    await hideDevChrome(page);
    await expect(page.locator('main')).toHaveScreenshot('landing-main.png', {
      animations: 'disabled',
      maxDiffPixels: 400,
    });
  });

  test('login card matches snapshot', async ({ page }) => {
    await page.goto('/login');
    await hideDevChrome(page);
    // 'main, body' looks like a fallback but CSS matches in DOM order, so
    // .first() always won <body> and the "card" snapshot was the whole page.
    await expect(page.locator('main')).toHaveScreenshot('login-main.png', {
      animations: 'disabled',
      maxDiffPixels: 400,
    });
  });
});
