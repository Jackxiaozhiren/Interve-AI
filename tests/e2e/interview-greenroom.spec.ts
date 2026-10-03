import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import { loginAs } from '../helpers';

test.describe('Interview Green Room', () => {
  test('Green Room flow and bypass', async ({ page, browserName }) => {
    const artifactsDir = path.join(process.cwd(), 'artifacts');
    const targetDir = path.join(artifactsDir, 'screenshots', browserName, 'interview-greenroom');
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }

    const captureScreenshot = async (name: string) => {
      const filePath = path.join(targetDir, `${name}.png`);
      try {
        await page.screenshot({ path: filePath });
      } catch (err) {
        console.error(`[ERROR] Failed to capture screenshot ${name}:`, err);
      }
    };

    // Go to interview page (id required by the preflight gate; no testMode
    // so the GreenRoom gate shows instead of skipping to standby).
    // NOTE: no `networkidle` wait — model workers keep the network busy.
    await loginAs(page);
    await page.goto('/interview?id=e2e-greenroom', { waitUntil: 'domcontentloaded' });

    // Verify Green Room is present
    const greenRoomHeading = page.locator('h1:has-text("设备自检室")');
    await expect(greenRoomHeading).toBeVisible();
    await captureScreenshot('01-greenroom-initial');

    // Find the bypass button and click it
    const bypassButton = page.locator('button:has-text("跳过语音测试，以纯文本模式继续")');
    await expect(bypassButton).toBeVisible();

    // The button is server-rendered, so it is visible and "stable" before React
    // has hydrated and attached its handler; under parallel load the interview
    // route is still being compiled by the dev server at this moment and the
    // click can land on dead DOM. Retrying the gesture until the effect is
    // observed tolerates that race without weakening what is asserted — the
    // green room must actually go away. Observed: at the default worker count
    // every run failed (two of three probes never recovered inside 60s); at
    // `--workers=1`, which is what CI uses, it passed three times unmodified.
    for (let attempt = 1; ; attempt++) {
      // The catch matters: if the previous click did land and the room is simply
      // slow to unmount, this button is already gone and click() would throw
      // rather than let the wait below observe the transition.
      await bypassButton.click({ timeout: 5000 }).catch(() => {});
      const gone = await greenRoomHeading
        .waitFor({ state: 'detached', timeout: 8000 })
        .then(() => true)
        .catch(() => false);
      if (gone) break;
      if (attempt >= 3) throw new Error(`green room still mounted after ${attempt} bypass clicks`);
    }
    await expect(greenRoomHeading).not.toBeVisible();
    const mainHeading = page.locator('h1:has-text("AI 面试间"), h2:has-text("实时对话")').first();
    await expect(mainHeading).toBeVisible();
    await captureScreenshot('02-interview-main-after-bypass');
  });
});
