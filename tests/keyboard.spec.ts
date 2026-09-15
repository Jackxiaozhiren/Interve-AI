// Phase 9: keyboard + focus e2e (WCAG 2.1.1 / 2.4.1 / 2.4.3).
import { test, expect } from '@playwright/test';
import { loginAs } from './helpers';

test.describe('Keyboard & Focus', () => {
  test('skip link moves focus into main content', async ({ page }) => {
    await page.goto('/');
    // Tab to the skip link (first tabbable element) and activate it.
    await page.keyboard.press('Tab');
    const skip = page.getByRole('link', { name: /跳转到主要内容/ });
    await expect(skip).toBeFocused();
    await page.keyboard.press('Enter');
    // Focus must land on #main-content, not merely scroll.
    await expect(page.locator('#main-content')).toBeFocused();
  });

  test('mic button is keyboard-operable (Enter toggles recording)', async ({ page }) => {
    // §9 flake guard: recording START loads the whisper worker + fake-mic
    // device; under parallel workers this starves and times out BEFORE any
    // steering code runs (pre-existing contention, not a product regression).
    // test.slow() triples the timeout budget; CI still pins --workers=1
    // for mic suites (see playwright.config.ts + EVALUATION_V2_REPORT §8/§9).
    test.slow();
    await loginAs(page);
    await page.goto('/interview?id=kbd-mic&testMode=true');
    // Bypass Green Room if shown (testMode usually skips it).
    const bypass = page.getByRole('button', { name: /跳过语音测试/i });
    if (await bypass.isVisible({ timeout: 5000 }).catch(() => false)) {
      await bypass.click();
    }
    // Enter standby room.
    const enter = page.getByRole('button', { name: /开始面试|强制开始/i });
    await expect(enter).toBeEnabled({ timeout: 35000 });
    await enter.click();

    const mic = page.getByRole('button', { name: /开始录音|停止录音/ });
    await expect(mic).toBeVisible({ timeout: 15000 });
    await mic.focus();
    await expect(mic).toBeFocused();
    // Keyboard activation must start recording (fake mic in CI).
    await page.keyboard.press('Enter');
    await expect(page.getByRole('button', { name: /停止录音/ })).toBeVisible({ timeout: 15000 });
    // Toggle off again via keyboard.
    await page.keyboard.press('Enter');
    await expect(page.getByRole('button', { name: /开始录音/ })).toBeVisible({ timeout: 15000 });
  });

  test('AI estimates are hidden by default with an opt-in toggle', async ({ page }) => {
    await loginAs(page);
    await page.goto('/interview?id=kbd-insights&testMode=true');
    const bypass = page.getByRole('button', { name: /跳过语音测试/i });
    if (await bypass.isVisible({ timeout: 5000 }).catch(() => false)) {
      await bypass.click();
    }
    const enter = page.getByRole('button', { name: /开始面试|强制开始/i });
    await expect(enter).toBeEnabled({ timeout: 35000 });
    await enter.click();

    // Locale-aware: headless browsers default to en; the toggle is bilingual.
    const toggle = page.getByRole('button', { name: /实时 AI 评估|AI estimates/i });
    await expect(toggle).toBeVisible({ timeout: 15000 });
    await expect(toggle).toHaveAttribute('aria-pressed', 'false');
    // Experimental tiles stay out of the tree until opted in.
    await expect(page.getByText('STAR Progress')).toHaveCount(0);
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByText('STAR Progress')).toBeVisible();
  });
});
