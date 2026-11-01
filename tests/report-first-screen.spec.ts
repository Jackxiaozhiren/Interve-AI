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
// must NOT be given a round number).
import { test, expect } from '@playwright/test';
import { createPostgrestStub, loginAs, seedSupabaseSession } from './helpers';

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

    const created = await page.evaluate(async () => {
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
                evidence: ['我们大概快了一点点'],
                rationale: '没有数字，听众无法判断量级。',
                confidence: 'high',
                improvement: '重录第 2 题，把结果量化成一个数字。',
              },
              {
                id: 'star_completeness',
                score: 3,
                evidence: ['我负责了那个项目'],
                rationale: '只说了职责，没有说任务与结果。',
                confidence: 'medium',
                improvement: '补上 Result：项目上线后发生了什么。',
              },
              {
                id: 'ownership',
                score: 4,
                evidence: ['我推动了这次迁移'],
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
            { id: 'm4', role: 'user', content: '我们大概快了一点点，具体没测。' },
            { id: 'm5', role: 'assistant', content: '项目里你做了什么？' },
            { id: 'm6', role: 'user', content: '我负责了那个项目的前端部分。' },
            { id: 'm7', role: 'user', content: '我推动了这次迁移，方案是我定的。' },
          ],
        }),
      });
      return (await res.json()) as { id: number };
    });

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

    // 3. Each item carries a quote AND names the round it came from.
    await expect(items.nth(0)).toContainText('第 2 轮');
    await expect(items.nth(0)).toContainText('我们大概快了一点点');
    await expect(items.nth(1)).toContainText('第 3 轮');

    // 4. On the first screen: a heading below the fold is not a first screen.
    const box = await block.boundingBox();
    const viewport = page.viewportSize();
    expect(box, 'the block rendered without a box').not.toBeNull();
    expect(Math.round((box?.y ?? 0) + (box?.height ?? 0))).toBeLessThanOrEqual(viewport?.height ?? 0);

    // 5. The citation is a control, and it takes the reader to the words.
    const cited = page.locator('[data-transcript-id="m4"]');
    await expect(cited).not.toHaveAttribute('data-cited', 'true');
    await items.nth(0).getByRole('button', { name: /第 2 轮/ }).click();
    await expect(cited).toHaveAttribute('data-cited', 'true');
    await expect(cited).toBeInViewport();
  });
});
