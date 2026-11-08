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
import { openSettleFailureRoom } from './helpers';

test.skip(!process.env.E2E_MOCK, 'needs E2E_MOCK=1 (mock AI server + stubbed DB)');

test.describe('P0-1 settle write failure', () => {
  test.setTimeout(180000);

  test('a failed save is stated on screen, retryable, and the retry reaches the report', async ({ page }) => {
    // The shared seam: POST succeeds so the row exists, the FIRST settle PATCH
    // fails like a 500, and every later one succeeds — the honest shape of
    // "created at setup, lost at settle". The 390px recovery lane uses the same
    // helper, so both specs always test the same failure.
    const { id, patchAttempts } = await openSettleFailureRoom(page, {
      email: 'unsaved@example.com',
      title: 'unsaved probe',
    });
    const endCall = page.getByRole('button', { name: /结束面试/i });

    await page.getByLabel(/输入您的回答/).fill('I led a state-management migration with measured results.');
    await page.getByRole('button', { name: /发送消息/ }).click();
    await expect(page.getByRole('log').getByText(/Mock interviewer/)).toBeVisible({ timeout: 60000 });

    await endCall.click();

    // 1. The failure is stated, in words a candidate can act on.
    const unsaved = page.getByRole('alert').filter({ hasText: '这次记录没有保存' });
    await expect(unsaved).toBeVisible({ timeout: 60000 });

    // 2. The room is where they stay: a broken save must not look like a
    //    successful exit to a page that happens to be empty.
    await expect(page).toHaveURL(new RegExp(`/interview\\?id=${id}`));

    // 3. The way out exists.
    await unsaved.getByRole('button', { name: /重试保存/ }).click();

    // 4. It lands on the report, and the report carries the evaluation —
    //    a 2xx that wrote an empty shell would fail here.
    await expect(page).toHaveURL(new RegExp(`/dashboard/report/${id}`), { timeout: 90000 });
    await expect(page.getByText(/Developing|Interview Ready|Needs Foundation|Strongly Prepared/)).toBeVisible({
      timeout: 30000,
    });
    await expect(page.getByText(/暂无维度数据/)).toHaveCount(0);
    expect(patchAttempts(), 'the retry must have attempted the write again').toBeGreaterThan(1);
  });
});
