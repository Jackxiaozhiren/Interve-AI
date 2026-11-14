// P0-2 (PRD F-4 §1–§2) — the report opens with the three changes that matter,
// each carrying one piece of evidence a reader can click back to.
//
// What this encodes, true of the report before the change: dimensions each had a
// score, a rationale and a "next drill", but the page opened with a training
// roadmap (technical / behavioural / resources) that names no round and quotes
// nobody. A candidate finishing an interview could not answer "what did I
// actually say that made you think that", which is the product's whole claim
// (§1.2 principle 1: every conclusion points back to the words).
//
// The fixture is seeded into the stubbed PostgREST table rather than produced by
// a run: the report page reads one row and renders it, and a seeded row lets the
// quotes be chosen to exercise the mapping (one exact quote, one paraphrase that
// must NOT be given a round number). Quotes are production-scale: on a real
// session (2026-11-02, interviews id=2) GLM wrote a 138-character evidence
// sentence, printed it whole on the card, and reused it for three dimensions —
// this fixture reproduces both failures at slightly under that size.
import { test, expect } from '@playwright/test';
import { createPostgrestStub, loginAs, seedSupabaseSession } from './helpers';

// 67 characters — beyond the 60-character fragment cut.
const LONG_QUOTE =
  '那次优化我们主要做了路由懒加载和组件拆分，整体来说页面渲染的速度大概是快了一点点，具体没有做很精确的测量，但是从用户反馈来看体验是有提升的。';
const OTHER_LONG_QUOTE =
  '我负责了那个项目的前端部分，包括组件的拆分和状态管理，还带着两个实习生一起做需求，项目最后按时上线了，用户量也涨了不少。';

test.describe('P0-2 report first screen', () => {
  // Next dev compiles each route on first request; a cold /dashboard/report is
  // slower than the 60s default and produced a timeout that said nothing about
  // the product.
  test.setTimeout(180000);

  test('opens with three cited improvements, and a citation jumps to its round', async ({ page }) => {
    await page.route('**/rest/v1/*', createPostgrestStub());
    const uid = await seedSupabaseSession(page);
    await loginAs(page, 'report@example.com', uid);
    await page.goto('/dashboard', { waitUntil: 'domcontentloaded' });

    // The evaluate body runs in the browser: the quotes must travel as arguments,
    // not as Node-scope constants the page context cannot see.
    const created = await page.evaluate(async ({ longQuote, otherLongQuote }) => {
      const res = await fetch('/rest/v1/interviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: 'P0-2 fixture',
          status: 'completed',
          created_at: '2026-11-01T08:00:00.000Z',
          evaluation_v2: {
            version: '2.0',
            rubricId: 'general-v1',
            readiness: 'developing',
            readinessRationale: 'Fixture rationale.',
            dimensions: [
              {
                id: 'specificity',
                score: 2,
                evidence: [longQuote],
                rationale: '没有数字，听众无法判断量级。',
                confidence: 'high',
                improvement: '重录第 2 题，把结果量化成一个数字。',
              },
              {
                id: 'star_completeness',
                score: 3,
                evidence: [otherLongQuote],
                rationale: '只说了职责，没有说任务与结果。',
                confidence: 'medium',
                improvement: '补上 Result：项目上线后发生了什么。',
              },
              {
                id: 'ownership',
                score: 4,
                // The measured bug: the model hands the same sentence to three
                // dimensions. This one must not print the quote a second time.
                evidence: [longQuote],
                rationale: '有主语，但决策过程没说清。',
                confidence: 'high',
                improvement: '说清你做的那个决定，以及为什么。',
              },
              {
                id: 'impact',
                score: 5,
                // A paraphrase the transcript never contains: it must render,
                // but it must not be given a round number it cannot support.
                evidence: ['面试里提到的那个性能数字'],
                rationale: 'fixture',
                confidence: 'low',
                improvement: '把影响说给非技术听众听。',
              },
            ],
            strengths: ['Fixture strength'],
            weaknesses: ['Fixture gap'],
            nextDrills: ['Fixture drill'],
            qaReview: [],
          },
          transcript: [
            { id: 'm1', role: 'assistant', content: '先做个自我介绍吧。' },
            { id: 'm2', role: 'user', content: '我有三年 React 经验，做过中后台系统。' },
            { id: 'm3', role: 'assistant', content: '那次性能优化带来多少提升？' },
            { id: 'm4', role: 'user', content: longQuote },
            { id: 'm5', role: 'assistant', content: '项目里你做了什么？' },
            { id: 'm6', role: 'user', content: otherLongQuote },
          ],
        }),
      });
      return (await res.json()) as { id: number };
    }, { longQuote: LONG_QUOTE, otherLongQuote: OTHER_LONG_QUOTE });

    await page.goto(`/dashboard/report/${created.id}`, { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('domcontentloaded');

    const block = page.getByRole('region', { name: /本次最该改的三件事/ });
    await expect(block).toBeVisible({ timeout: 30000 });

    // 1. Three, not a list of everything.
    await expect(block.getByRole('listitem')).toHaveCount(3);

    // 2. Weakest first: specificity (2) → star_completeness (3) → ownership (4).
    //    impact (5) is not on the first screen at all.
    const items = block.getByRole('listitem');
    await expect(items.nth(0)).toContainText('把结果量化成一个数字');
    await expect(items.nth(1)).toContainText('补上 Result');
    await expect(items.nth(2)).toContainText('说清你做的那个决定');

    // 3. A production-scale quote prints as a fragment, not the whole answer.
    await expect(items.nth(0)).toContainText('那次优化我们主要做了路由懒加载');
    await expect(block).not.toContainText('从用户反馈来看体验是有提升的');

    // 4. Each item names the round it came from, and the citation still points at
    //    the words even when the card only prints a fragment.
    await expect(items.nth(0)).toContainText('第 2 轮');
    await expect(items.nth(1)).toContainText('第 3 轮');

    // 5. The measured bug: ownership cites the same sentence as specificity, so it
    //    points back instead of printing the quote a second time.
    await expect(items.nth(2)).toContainText('同第 1 条原话');
    await expect(items.nth(2)).not.toContainText('那次优化我们主要做了路由懒加载');

    // 6. On the first screen: a heading below the fold is not a first screen.
    //    The failure message carries the geometry, because "788 > 720" alone never
    //    says whether the header or the items ate the viewport — that distinction
    //    is what turned this from a test-tuning question into a layout fix.
    const box = await block.boundingBox();
    const viewport = page.viewportSize();
    expect(box, 'the block rendered without a box').not.toBeNull();
    const geometry = await page.evaluate(() => {
      const out: Record<string, number> = {};
      const b = document.querySelector('[aria-labelledby="top-improvements-heading"]');
      if (b) out.blockTop = Math.round(b.getBoundingClientRect().top);
      document.querySelectorAll('[aria-labelledby="top-improvements-heading"] li').forEach((li, i) => {
        out[`item${i}`] = Math.round(li.getBoundingClientRect().height);
      });
      return out;
    });
    expect(
      Math.round((box?.y ?? 0) + (box?.height ?? 0)),
      `block bottom ${Math.round((box?.y ?? 0) + (box?.height ?? 0))} vs viewport ${viewport?.height} — ${JSON.stringify(geometry)}`,
    ).toBeLessThanOrEqual(viewport?.height ?? 0);

    // 7. The citation is a control, and it takes the reader to the words.
    const cited = page.locator('[data-transcript-id="m4"]');
    await expect(cited).not.toHaveAttribute('data-cited', 'true');
    await items.nth(0).getByRole('button', { name: /第 2 轮/ }).click();
    await expect(cited).toHaveAttribute('data-cited', 'true');
    await expect(cited).toBeInViewport();
  });

  /**
   * The four blocks Phase 4 added had unit guards but no browser coverage, so
   * "it renders" was an assumption. This asserts what a reader actually sees,
   * and it pins the one statement that must never drift: an unmeasured fairness
   * audit says so in words — it does not render as 0%.
   *
   * The RPC for same-track benchmarks is not in the stub's table list, so it
   * answers `200 []`; that is exactly the thin-cohort path, which must state the
   * floor rather than draw an empty chart.
   */
  test('renders the Phase 4 blocks, and says "not measured" instead of zero', async ({ page }) => {
    await page.route('**/rest/v1/*', createPostgrestStub());
    // The glob above matches a single path segment, so `/rest/v1/rpc/<fn>` slips
    // past it and would reach the placeholder host — which renders the failure
    // branch ("暂时读不到") instead of the thin-cohort branch this test is about.
    // Answer RPCs explicitly; an empty result is what an empty database returns.
    await page.route('**/rest/v1/rpc/**', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
    );
    const uid = await seedSupabaseSession(page);
    await loginAs(page, 'phase4@example.com', uid);
    await page.goto('/dashboard', { waitUntil: 'domcontentloaded' });

    const created = await page.evaluate(async () => {
      const res = await fetch('/rest/v1/interviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: 'Phase 4 fixture',
          status: 'completed',
          interview_type: 'frontend',
          created_at: '2026-11-01T08:00:00.000Z',
          evaluation_v2: {
            version: '2.0',
            rubricId: 'general-v1',
            readiness: 'developing',
            readinessRationale: 'Fixture rationale.',
            dimensions: [
              {
                id: 'specificity',
                score: 2,
                evidence: ['一句证据'],
                rationale: '缺少数字，听众无法判断量级。',
                confidence: 'high',
                improvement: '把结果量化成一个数字。',
              },
              {
                id: 'star_completeness',
                score: 3,
                evidence: ['另一句证据'],
                rationale: '只说了职责，没有说结果。',
                confidence: 'medium',
                improvement: '补上 Result。',
              },
            ],
            strengths: ['表达清晰'],
            weaknesses: ['缺量化'],
            nextDrills: ['重录第 2 题'],
            trainingRoadmap: {
              technical: ['建议先把结果量化，因为这段回答里没有数字。'],
              behavioral: ['建议先讲取舍再讲实现，因为目前只有实现细节。'],
              resources: ['建议重读「深度」一档，因为追问停留在概念层。'],
            },
            qaReview: [],
          },
          transcript: [
            { id: 'm1', role: 'assistant', content: '先做个自我介绍吧。' },
            { id: 'm2', role: 'user', content: '我有三年前端经验。' },
          ],
        }),
      });
      return (await res.json()) as { id: number };
    });

    await page.goto(`/dashboard/report/${created.id}`, { waitUntil: 'domcontentloaded' });

    // 1. Roadmap: advice a reader can act on, in Chinese, above the rubric.
    await expect(page.getByRole('heading', { name: /下一步练什么/ })).toBeVisible({ timeout: 30000 });
    await expect(page.getByText(/建议先把结果量化/)).toBeVisible();

    // 2. Fairness: absence is stated in words, and no rate is invented.
    await expect(
      page.getByText('这项对照测量还没有完成，所以这里不显示任何数字。')
    ).toBeVisible();
    await expect(page.getByText(/翻转率/)).toHaveCount(0);

    // 3. Cohort: with an empty RPC response the card names the floor.
    await expect(page.getByRole('heading', { name: '同类面试基准' })).toBeVisible();
    await expect(page.getByText(/同类样本还不够/)).toBeVisible();

    // 4. Dispute: the recorded way to disagree is reachable.
    await expect(page.getByRole('heading', { name: '对评分有异议？' })).toBeVisible();
    await expect(page.getByRole('button', { name: '我有异议' }).first()).toBeVisible();

    // 5. Share: the control exists. It is not clicked here — creating a link
    //    writes a row, and this lane's stub has no report_shares table.
    await expect(page.getByText('把这份报告发给朋友或导师')).toBeVisible();
    await expect(page.getByRole('button', { name: '生成分享链接' })).toBeVisible();
  });
});
