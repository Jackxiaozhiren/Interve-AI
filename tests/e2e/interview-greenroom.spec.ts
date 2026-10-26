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
    // click can land on dead DOM. Retrying the gesture is what tolerates that race.
    //
    // What ends the retry used to be an absence — `detached` on the green-room
    // heading, which is one instant of DOM and not the flow's outcome. Measured
    // (docs/audit/V11_REGISTER.md V11-21): in a local multi-worker lane the loop
    // broke on that signal, and the assertion three lines later found the heading
    // visible on **all 29** of its own polls, so the bypass had never taken effect
    // and the loop had reported success anyway. Waiting for the room to appear asks
    // the question the test is actually answering, and a failure now names the
    // gesture that did not work instead of a DOM state 15 s downstream.
    const mainHeading = page.locator('h1:has-text("AI 面试间"), h2:has-text("实时对话")').first();
    for (let attempt = 1; ; attempt++) {
      // The catch matters: a click that did land leaves this button gone, and
      // click() would throw rather than let the wait below observe the arrival.
      await bypassButton.click({ timeout: 5000 }).catch(() => {});
      const arrived = await mainHeading
        .waitFor({ state: 'visible', timeout: 8000 })
        .then(() => true)
        .catch(() => false);
      if (arrived) break;
      if (attempt >= 3) {
        throw new Error(`the bypass press never reached the room after ${attempt} attempts`);
      }
    }
    await expect(greenRoomHeading).not.toBeVisible();
    await expect(mainHeading).toBeVisible();
    await captureScreenshot('02-interview-main-after-bypass');
  });
});
