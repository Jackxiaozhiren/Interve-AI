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
   * Contrast depends on what a text node looks like *and* on where it sits, so this
   * compares that pair 200 ms apart and requires it identical. Labels that are
   * *deliberately* translucent settle at once — two council titles sit at opacity 0.4
   * with no animation and pass immediately, which is the point: the wait is about
   * change, not about translucency. When it does time out, the received value names the
   * moving node and its state, so the red says what to look at.
   *
   * Position is part of the signature because axe resolves a text node's background by
   * asking what is behind it. A node translated a few pixels by an in-flight
   * framer-motion animation therefore overlaps a different set of layers, and the scan
   * measures a different page. That is the measured cause of both symptoms this
   * predicate now covers: the interview room's unresolved-contrast count alternating
   * between 17 and 18 across identical runs, and an intermittent `color-contrast`
   * *violation* on the status pill whose reported target was `:root` with an empty
   * message — a node sampled while `AnimatePresence mode="wait"` was remounting it,
   * mid-`transform`. Opacity alone could not see either, because a remount can finish at
   * the same opacity and the same first twelve characters.
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
                    .map((el) => {
                      const r = el.getBoundingClientRect();
                      return (
                        `${getComputedStyle(el).opacity}|` +
                        `${Math.round(r.x)},${Math.round(r.y)} ${Math.round(r.width)}x${Math.round(r.height)}|` +
                        (el.textContent ?? '').trim().slice(0, 12)
                      );
                    })
                    .join(';');
                const before = read();
                setTimeout(() => {
                  const after = read();
                  resolve(before === after ? 'settled' : `moving: ${after.split(';').filter((s) => !before.split(';').includes(s)).slice(0, 4).join(' ')}`);
                }, 200);
              }),
          ),
        { timeout: 20000, message: 'the page kept changing the look or place of visible text' },
      )
      .toBe('settled');
  }

  /**
   * Put every JS-animated element back at its resting opacity, then scan.
   *
   * axe composites a text node's colour through whatever opacity is applied at the
   * moment it measures and judges the result, so a label caught halfway through an enter
   * or exit fade is scored against a state the design never shows. Three captures from
   * this lane, all of the same status pill, show the range: fading *in* it reported
   * `1.97:1` with foreground `#91b2b6` (slate-600 through a half-faded alpha); calling
   * `finish()` on every animation made it worse, because the same pill's *exit* ends at
   * opacity 0 and three nodes then read `1.05`, `1.46`, `1.57` — invisible text judged as
   * if it were readable; and waiting for "no text animation is running" before and after
   * the scan still failed once in eight runs, because a fade that starts and ends inside
   * the scan window is invisible to both checks.
   *
   * Overriding the property removes the race instead of narrowing it. The selector is
   * deliberately narrow: `[style*=…]` matches only the inline `opacity` that
   * framer-motion writes per frame, so a class-driven `opacity-40` — the council titles
   * are *designed* translucent and must still be judged — is left exactly as it is.
   */
  async function scanAtRest(page: Page) {
    await page.addStyleTag({ content: '[style*="opacity"]{opacity:1 !important}' });
    return new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
  }

  /**
   * One scan for every arm: violations must be empty, and the nodes axe could *not*
   * judge have to be counted instead of thrown away.
   *
   * The first assertion is unchanged in what it demands, but its message now carries
   * each node's selector, axe's own reason text and its markup — the earlier text printed
   * only `color-contrast: 2 nodes`, which left attribution as a guess.
   *
   * The second is new, and it exists because axe separates "this fails" from "I cannot
   * tell", and this helper used to read only the first. A node lands in `incomplete`
   * when axe cannot resolve the background behind the text — translucent, overlapped by
   * another element, a gradient, an image — which is most of what the room's glass
   * surfaces are. Until now every one of those disappeared without a trace and the lane
   * reported a clean scan of text it had never compared.
   *
   * Measured on 2026-10-22 over fifteen runs of this lane with the resting-state override
   * in place: `/` reports 3 unresolved nodes every time, `/login` 11 every time, and the
   * room 17 or 18 — a ceiling of 17 was breached by one run in six, so 18 is the observed
   * maximum rather than a single reading. An earlier draft of this comment claimed the
   * room was stable at 17 on the strength of three samples; the fourth run produced 18.
   * The ±1 is the room's decorative layers moving relative to text that no settle
   * predicate can fully pin, so the jitter is measured, bounded, and documented rather
   * than chased.
   *
   * So this is a ratchet over a blind spot, not a claim of safety: a number going down
   * means a surface became measurable, and a count above the ceiling means the unmeasured
   * area grew by more than the known jitter and someone has to say why. Lower it when a
   * panel gets a resolvable background; never raise it to accommodate one. At 0, delete
   * the argument and the assertion with it.
   */
  async function expectNoSeriousViolations(page: Page, unresolvedContrastCeiling: number) {
    const results = await scanAtRest(page);
    const bad = results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
    expect(
      bad.map((v) => `${v.id}: ${v.nodes.length} nodes`),
      JSON.stringify(bad.map((v) => ({
        id: v.id,
        targets: v.nodes.map((n) => n.target.join(' ')),
        why: v.nodes.map((n) => (n.any || []).map((a) => a.message).join(' / ').slice(0, 200)),
        html: v.nodes.map((n) => n.html.slice(0, 200)),
      }))),
    ).toEqual([]);

    const unresolved = results.incomplete.filter((i) => i.id === 'color-contrast').flatMap((i) => i.nodes);
    const reasons = new Map<string, number>();
    for (const n of unresolved) {
      const key = (n.any?.[0]?.message ?? 'no reason given').replace(/[^a-z ]/gi, '').trim().slice(0, 58) || 'no reason given';
      reasons.set(key, (reasons.get(key) ?? 0) + 1);
    }
    expect(
      unresolved.length,
      `axe could not judge contrast on ${unresolved.length} text node(s); ceiling is ${unresolvedContrastCeiling}. ` +
        `These are not passes — they are measurements that never happened. By reason: ` +
        ([...reasons].map(([k, v]) => `${v}× ${k}`).join(' | ') || 'none') +
        `. Nodes: ${unresolved.map((n) => n.target.join(' ')).join(', ').slice(0, 700)}`,
    ).toBeLessThanOrEqual(unresolvedContrastCeiling);
  }

  test('landing has no serious/critical axe violations', async ({ page }) => {
    await page.goto('/');
    await settleForScan(page);
    await expectNoSeriousViolations(page, 3);
  });

  test('login has no serious/critical axe violations', async ({ page }) => {
    await page.goto('/login');
    await settleForScan(page);
    await expectNoSeriousViolations(page, 11);
  });

  /**
   * `/setup` step 1 only. The wizard has six steps and the arm does not walk them, so
   * this is a floor on coverage, not a claim about the page: the 16 `text-slate-400`
   * sites in this file (2.49:1 on its near-white surfaces) are mostly on steps the scan
   * never reaches. Two of them were live AA failures found on the arm's first run —
   * the progress line and the step-index badge — and are fixed; the rest are recorded in
   * `docs/audit/V11_REGISTER.md` rather than swept, because a repo-wide colour change
   * driven by three scanned routes is a design decision, not a defect fix.
   */
  test('setup has no serious/critical axe violations', async ({ page }) => {
    await loginAs(page);
    await page.goto('/setup');
    await settleForScan(page);
    await expectNoSeriousViolations(page, 10);
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
    await expectNoSeriousViolations(page, 18);
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
