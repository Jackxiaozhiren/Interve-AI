import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

test.describe('Interview Interactive Features', () => {
  test('keyboard shortcuts and text selection menu', async ({ page, browserName }) => {
    // Determine target directory for screenshots
    const artifactsDir = path.join(process.cwd(), 'artifacts');
    const targetDir = path.join(artifactsDir, 'screenshots', browserName, 'interview-interactive');
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

    await page.goto('/interview?id=test_id&testMode=true');
    await page.waitForLoadState('networkidle');
    await captureScreenshot('initial_load');

    // Bypass Green Room just in case testMode=true didn't work immediately
    const bypassButton = page.getByRole('button', { name: /跳过语音测试|纯文本模式/i }).first();
    if (await bypassButton.isVisible({ timeout: 5000 }).catch(() => false)) {
      await bypassButton.click();
      await page.waitForLoadState('networkidle');
      await captureScreenshot('after_greenroom_bypass');
    }

    // Wait for the standby overlay "开始面试" button and click it to ensure we are ready
    const startButton = page.getByRole('button', { name: /开始面试|强制开始/i }).first();
    // Wait up to 30s for models to load and the button to be ready
    await startButton.waitFor({ state: 'visible', timeout: 30000 });
    await expect(startButton).toBeEnabled({ timeout: 30000 });
    await startButton.click();
    await captureScreenshot('after_standby_bypass');

    const inputLocator = page.locator('input[type="text"]').last();
    // Wait until the input is no longer disabled
    await expect(inputLocator).toBeEnabled({ timeout: 20000 });

    // Test Cmd/Ctrl + K shortcut to focus chat input
    await page.keyboard.press('Escape'); // Ensure no active focus
    const modifier = process.platform === 'darwin' ? 'Meta' : 'Control';
    await page.keyboard.press(`${modifier}+K`);
    await page.waitForTimeout(500);

    await expect(inputLocator).toBeFocused();
    await captureScreenshot('after_shortcut_k');

    // Test text selection -> ask AI
    // We select the "实时对话" or "AI 面试间" text
    const headerElement = page.locator('h1:has-text("AI 面试间"), h2:has-text("实时对话")').first();
    await headerElement.waitFor({ state: 'visible' });
    await headerElement.selectText();
    await page.mouse.up();
    
    // Wait for the text selection menu to appear
    const askAiBtn = page.locator('button[aria-label="将选中文本发送给AI"]');
    await expect(askAiBtn).toBeVisible({ timeout: 5000 });
    await captureScreenshot('text_selection_menu');

    await askAiBtn.click();
    
    // Check if input gets populated with the selected text
    await expect(inputLocator).toHaveValue(/关于以下内容：/i);
    await captureScreenshot('after_ask_ai_click');

    // Test Cmd/Ctrl + M shortcut to toggle mic (might just show a toast or change state since we are in test mode without mic, or might trigger permissions)
    // We'll just verify it doesn't crash and we can trigger it.
    await page.keyboard.press(`${modifier}+M`);
    await page.waitForTimeout(1000);
    await captureScreenshot('after_shortcut_m');
  });
});
