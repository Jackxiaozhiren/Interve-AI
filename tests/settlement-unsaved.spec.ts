// P0-1 (B-2) — a settle write that fails must be visible and retryable.
//
// What this encodes, observed on 2026-11-01 before the fix (mock lane,
// PATCH /rest/v1/interviews forced to 500, row created at setup):
//   role="alert" nodes on the destination page: []
//   URL: /dashboard/report/1   ← a normal-looking navigation
//   report body: "READINESS Pending (评估中) / 暂无总评数据 / 雷达图数据不可用"
// The evaluation and the transcript were gone, and the page said "still
// processing". A candidate reads that as a slow report, not as data loss.
//
// This spec is the check from the PRD's P0-1: the failure is stated on screen
// ("这次记录没有保存"), a retry exists, and a retry that succeeds lands on the
// report with the evaluation actually readable.
import { test, expect } from '@playwright/test';
import { createPostgrestStub, loginAs, seedSupabaseSession } from './helpers';

test.skip(!process.env.E2E_MOCK, 'needs E2E_MOCK=1 (mock AI server + stubbed DB)');

test.describe('P0-1 settle write failure', () => {
  test.setTimeout(180000);

  test('a failed save is stated on screen, retryable, and the retry reaches the report', async ({ page }) => {
    // The stub, with one seam: the FIRST settle PATCH fails the way a 500 does,
    // every later one succeeds. POST succeeds so the row exists — the honest
    // shape of "created at setup, lost at settle".
    const stub = createPostgrestStub();
    let patchAttempts = 0;
    await page.route('**/rest/v1/*', async (route) => {
      const req = route.request();
      const table = new URL(req.url()).pathname.split('/').pop();
      if (table === 'interviews' && req.method() === 'PATCH') {
        patchAttempts += 1;
        if (patchAttempts === 1) {
          return route.fulfill({
            status: 500,
            contentType: 'application/json',
            body: JSON.stringify({ code: 'XX000', message: 'simulated write failure' }),
          });
        }
      }
      return stub(route);
    });

    const uid = await seedSupabaseSession(page);
    await loginAs(page, 'unsaved@example.com', uid);
    await page.goto('/dashboard');

    const created = await page.evaluate(async () => {
      const res = await fetch('/rest/v1/interviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'unsaved probe', status: 'in_progress' }),
      });
      return (await res.json()) as { id: number };
    });

    await page.goto(
      `/interview?id=${created.id}&role=frontend&level=Mid-Level&persona=supportive&framework=general&aiModel=zhipu`,
    );

    await page.getByRole('button', { name: /跳过语音测试/i }).click({ timeout: 60000 });
    await page.getByRole('button', { name: /开始面试|强制开始/i }).click({ timeout: 60000 });
    const endCall = page.getByRole('button', { name: /结束面试/i });
    await expect(endCall).toBeVisible({ timeout: 30000 });

    await page.getByLabel(/输入您的回答/).fill('I led a state-management migration with measured results.');
    await page.getByRole('button', { name: /发送消息/ }).click();
    await expect(page.getByRole('log').getByText(/Mock interviewer/)).toBeVisible({ timeout: 60000 });

    await endCall.click();

    // 1. The failure is stated, in words a candidate can act on.
    const unsaved = page.getByRole('alert').filter({ hasText: '这次记录没有保存' });
    await expect(unsaved).toBeVisible({ timeout: 60000 });

    // 2. The room is where they stay: a broken save must not look like a
    //    successful exit to a page that happens to be empty.
    await expect(page).toHaveURL(new RegExp(`/interview\\?id=${created.id}`));

    // 3. The way out exists.
    await unsaved.getByRole('button', { name: /重试保存/ }).click();

    // 4. It lands on the report, and the report carries the evaluation —
    //    a 2xx that wrote an empty shell would fail here.
    await expect(page).toHaveURL(new RegExp(`/dashboard/report/${created.id}`), { timeout: 90000 });
    await expect(page.getByText(/Developing|Interview Ready|Needs Foundation|Strongly Prepared/)).toBeVisible({
      timeout: 30000,
    });
    await expect(page.getByText(/暂无维度数据/)).toHaveCount(0);
    expect(patchAttempts, 'the retry must have attempted the write again').toBeGreaterThan(1);
  });
});
