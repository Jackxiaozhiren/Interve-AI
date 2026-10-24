// Phase 14: automated accessibility scans (axe-core) + visual regression.
// - axe: serious/critical violations fail the suite on public + key flows.
// - visual: landing hero + login card snapshots (animations disabled).
//   Snapshots live beside this file; regenerate deliberately via
//   `playwright test -u` after INTENTIONAL visual changes only.
import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { loginAs } from './helpers';
import { classifyContrastNode, type AxeContrastBucket } from './axe-incomplete-reasons';

/**
 * Next's dev-tools host has to be out of both lanes' way, and each lane has to
 * know it is.
 *
 * It used to be *masked* (`mask: [locator('nextjs-portal')]`) in the visual lane,
 * which is wrong twice over. A mask paints magenta over what it covers, so a mask
 * that works leaves harness pixels in the baseline. And a mask whose element has no
 * painted box covers nothing while still looking configured — which is what had
 * actually happened: the PR #147 CI run's two ubuntu captures contain **zero
 * magenta pixels**, and they differ from the committed baselines only in the
 * bottom-left corner where the indicator lives (landing: 4,334 px inside
 * x[1..74] y[661..733], the collapsed "N" badge; login: 9,064 px inside x[1..156]
 * y[656..719], the expanded "N · 1 Issue ✕" pill). The pill had been written into
 * the product's visual truth, and the lane kept passing against it because the
 * baseline and the harness error changed together — until a run where the error did
 * not fire.
 *
 * The axe lane needs the same hide for the same reason, in a different currency:
 * measured 2026-10-24, the pill's own label arrives as a `color-contrast`
 * *incomplete* (`div[data-description=""]`, "partially obscured by another
 * element"), so it consumes one seat of a ceiling that counts the product's
 * unmeasured text — and it is intermittent, so the ceiling had to carry a ±1 that
 * was never the product's jitter at all. A harness artefact in an accessibility
 * denominator is the same mistake as one in a baseline.
 *
 * Hiding is deterministic and leaves no mask artefact. The two assertions after it
 * are what make the hide load-bearing instead of decorative: the first fails if
 * Next renames the host (nothing to hide), the second if the rule stops applying
 * (hidden on paper, painted anyway). Measured mechanism, on a synthetic `:host`
 * shadow element painting a fixed pill from a document stylesheet: 2,236 pill
 * pixels before the rule, 0 after.
 */
const DEV_CHROME_HOST = 'nextjs-portal';

const hideDevChrome = async (page: Page) => {
  await page.addStyleTag({ content: `${DEV_CHROME_HOST}{display:none !important}` });
  const portal = page.locator(DEV_CHROME_HOST);
  await expect(
    portal,
    `Next's dev-tools host is not mounted as <${DEV_CHROME_HOST}>: this lane has nothing to hide, ` +
      'and whatever the indicator paints is now part of what it measures',
  ).toHaveCount(1);
  await expect
    .poll(() => portal.evaluate((el) => getComputedStyle(el).display), {
      message:
        `the dev-tools host is still painted: <${DEV_CHROME_HOST}> is visible to layout, so this ` +
        'lane is measuring Next\'s indicator alongside the product',
    })
    .toBe('none');
};

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
   * The alpha has to be the **effective** one — the product down the ancestor chain —
   * because that is what axe composites the text colour through. Measured on the
   * recording toast, sampled every 25 ms from the arm's own click: `a=0.000 → #ffffff`
   * (1.0:1), `a=0.408 → #b1b1b1`, `a=0.645 → #838383`, `a=0.983 → #424242`, settling at
   * `#3f3f3f` — sonner's real resting colour, 10.9:1 and passing. The lane's
   * intermittent `insufficient color contrast of 3.79 (#838383 on #ffffff)` was that
   * third sample.
   *
   * Two honest limits on what this change buys. A control that ran both readers 200 ms
   * apart through the same fade showed the old self-opacity reader calling it "moving"
   * too (4 of 6 rounds) — not because it saw the alpha, but because the toast's text
   * nodes appear between the samples. What a self-opacity read cannot see is a fade on
   * text that is already mounted: the exit ramp was measured at `a=0.863` with the
   * string unchanged, so the old signature reported it settled. And the toast can also
   * mount *after* `settleForScan` returns, which no "is it stable now" predicate can
   * prevent — that half is closed by `scanAtRest` pinning the toast's opacity instead.
   *
   * Position is part of the signature too, for the same reason as the alpha: axe
   * resolves a background by asking what is behind a node, so a node translated a few
   * pixels by an in-flight animation overlaps a different set of layers and the scan
   * measures a different page. That is the measured cause of the room's
   * unresolved-contrast count alternating between 17 and 18, and of an earlier
   * violation whose target was `:root` with an empty message — a pill sampled while
   * `AnimatePresence mode="wait"` was remounting it.
   */
  async function settleForScan(page: Page) {
    await expect
      .poll(
        () =>
          page.evaluate(
            () =>
              new Promise<string>((resolve) => {
                const effectiveAlpha = (el: Element) => {
                  let a = 1;
                  for (let cur: Element | null = el; cur; cur = cur.parentElement) {
                    a *= Number(getComputedStyle(cur).opacity);
                  }
                  return a.toFixed(3);
                };
                const read = () =>
                  Array.from(document.querySelectorAll('*'))
                    .filter((el) =>
                      Array.from(el.childNodes).some((n) => n.nodeType === 3 && (n.textContent ?? '').trim().length > 0),
                    )
                    .map((el) => {
                      const r = el.getBoundingClientRect();
                      return (
                        `${effectiveAlpha(el)}|` +
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
   * Overriding the property removes the race instead of narrowing it. Two selectors,
   * because two mechanisms write opacity: `[style*=…]` catches the inline value
   * framer-motion writes per frame, and `[data-sonner-toast]` catches sonner's CSS
   * `@keyframes` fade, which never touches the style attribute — that is the one the
   * recording toast rides, and the first version of this rule missed it. Both are
   * deliberately narrow: a class-driven `opacity-40` — the council titles are *designed*
   * translucent and must still be judged — is left exactly as it is.
   */
  async function scanAtRest(page: Page) {
    await page.addStyleTag({
      content:
        '[style*="opacity"]{opacity:1 !important}' +
        '[data-sonner-toast]{opacity:1 !important;animation:none !important}',
    });
    return new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
  }

  /**
   * A node axe put in `incomplete` but had actually measured.
   *
   * `shortTextContent` is not a blind spot. In axe's own evaluator it is emitted
   * from `!isValid && visibleText.length === 1 && !ignoreLength`, and `isValid`
   * means "this pair meets the required ratio". So the key does not say "I could not
   * tell whether this is text" — it says **"I measured this, it fails, and I am not
   * filing it because the node holds one character."** It is a masked AA failure, and
   * putting a ceiling over it would be a licence to keep failing.
   *
   * Measured rather than inferred, and this is the finding that reframed the whole
   * pass: the room arm reported five `shortTextContent` nodes on 2026-10-22 — the
   * FlowMap step dots, one digit each. Sampling the painted pixel behind the glyph
   * gave white-on-sky-500 at 2.77:1 and slate-500-on-slate-100 at 4.34:1, both real
   * AA failures the lane had been counting as "unmeasurable". After the dots were
   * re-coloured, five consecutive runs report `shortTextContent=0` on the room and
   * the arm's unresolved total falls from 17-18 to 11-14, with nothing appearing in
   * `violations` either — which is what a definite pass looks like here.
   *
   * axe leaves the evidence on the node: `data.fgColor`, `data.bgColor`,
   * `data.contrastRatio` and `data.expectedContrastRatio` are all filled when it
   * resolved the pair, even when it then hedged about filing it. So this reads the
   * ratio back out and refuses any unresolved node whose two colours axe resolved but
   * whose measured ratio is under the ratio axe itself expected. Nodes with no
   * resolved pair — translucent stacks, gradients, overlap — stay with the ceilings,
   * because those genuinely were never compared.
   */
  function measuredFailuresOf(unresolved: { any: { data?: unknown }[]; target: readonly unknown[] }[]) {
    const label = (t: readonly unknown[]) => t.map((part) => String(part)).join(' ');
    return unresolved
      .map((n) => ({ node: n, d: n.any?.[0]?.data as Record<string, unknown> | undefined }))
      .filter(({ d }) => typeof d?.fgColor === "string" && typeof d?.bgColor === "string")
      .map(({ node, d }) => ({
        target: label(node.target),
        key: String(d?.messageKey),
        got: Number(d?.contrastRatio),
        need: Number.parseFloat(String(d?.expectedContrastRatio)),
        pair: `${d?.fgColor} on ${d?.bgColor}`,
      }))
      .filter((r) => Number.isFinite(r.got) && Number.isFinite(r.need) && r.got < r.need);
  }

  /**
   * One scan for every arm: violations must be empty, anything axe measured but
   * hedged about has to be caught by `measuredFailuresOf`, and the nodes it
   * truly could not judge have to be counted instead of thrown away.
   *
   * The first assertion is unchanged in what it demands, but its message now carries
   * each node's selector, axe's own reason text and its markup — the earlier text printed
   * only `color-contrast: 2 nodes`, which left attribution as a guess.
   *
   * The rest exists because axe separates "this fails" from "I cannot tell", and this
   * helper used to read only the first. Until 2026-10-22 every unresolved node
   * disappeared without a trace and the lane reported a clean scan of text it had
   * never compared.
   *
   * Buckets are axe's own `data.messageKey` values, unmerged, from
   * `tests/axe-incomplete-reasons.ts`; that file explains why a paraphrase of them is
   * not good enough. A ceiling is a statement about one specific cause, so "sits under
   * something else" and "overlaps something else" have to be different numbers.
   *
   * What the buckets corrected, besides the above, is the cause this comment used to
   * assign. It claimed unresolved nodes arrive because "the room's glass surfaces" are
   * translucent. Measured against axe's keys, no node in any arm reported
   * `fgAlpha` — translucency was never the reason. The room's are `bgGradient`,
   * `bgOverlap`, `elmPartiallyObscured` and `imgNode`; login's are overwhelmingly
   * `bgImage`. Those are layering and paint-order problems, and the room's `bgOverlap`
   * nodes are a control painted over a label, which is worth a look of its own.
   *
   * So the ceilings are a ratchet over a blind spot, not a claim of safety: a number
   * going down means a surface became measurable, a bucket above its ceiling means that
   * particular blind spot grew and someone has to say why, and a bucket no arm declares
   * fails the run outright. Lower a ceiling when a panel gets a resolvable background;
   * never raise one to accommodate a new node.
   */
  async function expectNoSeriousViolations(page: Page, ceilings: Partial<Record<AxeContrastBucket, number>>) {
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
    const masked = measuredFailuresOf(unresolved);
    expect(
      masked,
      `axe measured these pairs and then declined to file them; these are AA failures, not blind spots: ` +
        masked.map((m) => `${m.key}: ${m.got}:1 against ${m.need}:1 (${m.pair}) at ${m.target.slice(0, 70)}`).join(' | ')
    ).toEqual([]);

    // Only nodes whose pair axe could not resolve are blind spots. A node it resolved
    // and cleared was measured, and counting it here would inflate the ceiling with
    // text the lane has actually compared.
    const unmeasured = unresolved.filter((n) => {
      const d = n.any?.[0]?.data as Record<string, unknown> | undefined;
      return !(typeof d?.fgColor === 'string' && typeof d?.bgColor === 'string');
    });
    const buckets = new Map<string, string[]>();
    const unknowns = new Set<string>();
    for (const n of unmeasured) {
      const c = classifyContrastNode(n);
      const key = 'bucket' in c ? c.bucket : `undeclared:${c.unknownKey}`;
      if (!('bucket' in c)) unknowns.add(c.unknownKey);
      buckets.set(key, [...(buckets.get(key) ?? []), n.target.join(' ')]);
    }
    // An axe reason this table does not know must not be able to hide inside a
    // declared bucket's ceiling. It names itself and fails on its own.
    expect(
      [...unknowns],
      `axe reported a contrast reason no bucket declares; these nodes were counted nowhere: ${[...unknowns].join(', ')}`
    ).toEqual([]);

    const described = [...buckets]
      .map(([k, v]) => `${k}=${v.length}/${ceilings[k as AxeContrastBucket] ?? 'undeclared'}`)
      .sort()
      .join(' ');

    for (const [name, nodes] of buckets) {
      const ceiling = ceilings[name as AxeContrastBucket];
      expect(
        ceiling,
        `axe could not judge contrast on ${nodes.length} "${name}" node(s) and no arm declares that bucket. ` +
          `This scan measured ${described}. Nodes: ${nodes.join(', ').slice(0, 400)}`
      ).toBeDefined();
      expect(
        nodes.length,
        `axe could not judge contrast on ${nodes.length} "${name}" node(s); this arm's ceiling is ${ceiling}. ` +
          `These are not passes — they are measurements that never happened. All buckets: ${described}. ` +
          `Nodes: ${nodes.join(', ').slice(0, 400)}`
      ).toBeLessThanOrEqual(ceiling!);
    }
  }

  /**
   * Ceilings are each key's own observed maximum, measured 2026-10-24 over four
   * runs per arm after the dev-chrome hide and the masked-failure check landed.
   *
   * Per key, not per arm, is the point: `/` at three `bgGradient` nodes and the room
   * at three `bgGradient` nodes are the same problem on two routes, and a total would
   * let a fourth gradient on `/` be absorbed by the room's overlap count going down.
   * Because each key is held at its own maximum, the sum of an arm's ceilings can
   * exceed any single run's total — the room's is 15 against an observed maximum of
   * 13 — and that is deliberate: it is the conservative reading, and a ratchet that
   * only binds on the aggregate binds on nothing.
   *
   * The room's `bgOverlap` was observed at 5, 6 and 7 and `elmPartiallyObscured` at 2
   * and 4 across nine runs, so those two carry their maximum rather than their mode.
   * Every other key was identical in every run.
   */
  test('landing has no serious/critical axe violations', async ({ page }) => {
    await page.goto('/');
    await hideDevChrome(page);
    await settleForScan(page);
    await expectNoSeriousViolations(page, { bgGradient: 3 });
  });

  test('login has no serious/critical axe violations', async ({ page }) => {
    await page.goto('/login');
    await hideDevChrome(page);
    await settleForScan(page);
    await expectNoSeriousViolations(page, { bgImage: 10, elmPartiallyObscured: 1 });
  });

  /**
   * `/setup` step 1 only. The wizard has six steps and the arm does not walk them, so
   * this is a floor on coverage, not a claim about the page: 14 `text-slate-400` sites
   * remain in this file — 2.56:1 on its white surfaces — and most sit on steps the scan
   * never reaches. Three live AA failures were found here and fixed: the progress line,
   * the step-index badge, and the five step numbers still in the future at scan time,
   * each of which axe *measured* at 2.63:1 and then withheld from `violations` because
   * it holds one character (`measuredFailuresOf` is what made that visible). The rest
   * are recorded in `docs/audit/V11_REGISTER.md` rather than swept, because a repo-wide
   * colour change driven by three scanned routes is a design decision, not a defect fix.
   */
  test('setup has no serious/critical axe violations', async ({ page }) => {
    await loginAs(page);
    await page.goto('/setup');
    await hideDevChrome(page);
    await settleForScan(page);
    await expectNoSeriousViolations(page, { bgGradient: 3, bgOverlap: 1, elmPartiallyObscuring: 1 });
  });


  test('interview room has no serious/critical axe violations', async ({ page }) => {
    await loginAs(page);
    await page.goto('/interview?id=axe-room&testMode=true');
    await hideDevChrome(page);
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
    await expectNoSeriousViolations(page, {
      bgGradient: 3,
      bgOverlap: 7,
      elmPartiallyObscured: 4,
      imgNode: 1,
    });
  });
});

test.describe('Visual regression', () => {
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
