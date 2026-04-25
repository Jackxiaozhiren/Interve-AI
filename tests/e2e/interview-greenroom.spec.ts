import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

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

    // Go to interview page
    await page.goto('/interview');
    await page.waitForLoadState('networkidle');

    // Verify Green Room is present
    const greenRoomHeading = page.locator('h1:has-text("设备自检室")');
    await expect(greenRoomHeading).toBeVisible();
    await captureScreenshot('01-greenroom-initial');

    // Find the bypass button and click it
    const bypassButton = page.locator('button:has-text("跳过语音测试，以纯文本模式继续")');
    await expect(bypassButton).toBeVisible();
    await bypassButton.click();

    // Verify Green Room is gone and main interview page is loaded
    await expect(greenRoomHeading).not.toBeVisible();
    const mainHeading = page.locator('h1:has-text("AI 面试间"), h2:has-text("实时对话")').first();
    await expect(mainHeading).toBeVisible();
    await captureScreenshot('02-interview-main-after-bypass');
  });
});
