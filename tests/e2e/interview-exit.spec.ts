// PRD F-2's premise is that opening a room is a decision the candidate can
// reverse. Both gates before the room — the device check and the standby card —
// fill the screen at z-50, and the end-interview control lives in the transcript
// panel behind them. Before this, the only exit was the browser's back button:
// a control the product does not own and a phone does not always show.
//
// This file is separate from interview-greenroom.spec.ts on purpose. The exit is
// its own claim, and the green-room spec's artifact-directory boilerplate is
// already duplicated with interview-interactive.spec.ts; adding a case there
// would pull that block into the new-code window of every future change.
import { test, expect } from '@playwright/test';
import { loginAs } from '../helpers';

test.describe('leaving a room that has not started', () => {
  test('both gates offer the same way out', async ({ page }) => {
    await loginAs(page);

    // The control is server-rendered before React attaches its handler, so a
    // single press can land on dead DOM. What ends the retry is the outcome the
    // test is actually asking for — the dashboard URL — never a DOM state.
    const leave = async () => {
      for (let attempt = 1; ; attempt++) {
        await page.getByRole('button', { name: '先不面试，返回控制台' }).click({ timeout: 5000 }).catch(() => {});
        const left = await page
          .waitForURL(/\/dashboard/, { timeout: 6000 })
          .then(() => true)
          .catch(() => false);
        if (left) return;
        if (attempt >= 3) throw new Error(`the exit press never reached the dashboard after ${attempt} attempts`);
      }
    };

    // Gate 1: the device check.
    await page.goto('/interview?id=e2e-exit', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('h1:has-text("设备自检室")')).toBeVisible();
    await leave();
    await expect(page).toHaveURL(/\/dashboard/);

    // Gate 2: the standby card, which sits on top of the room at z-50.
    await page.goto('/interview?id=e2e-exit&testMode=true', { waitUntil: 'domcontentloaded' });
    await expect(page.getByText('准备好开始了吗？')).toBeVisible({ timeout: 30000 });
    await leave();
    await expect(page).toHaveURL(/\/dashboard/);
  });
});
