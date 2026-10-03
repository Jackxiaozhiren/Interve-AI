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
    // Recording START loads the whisper worker + fake-mic device, so this is the
    // only test in the repo that needs `modelsReady` to become true. It is
    // excluded from every CI lane (`npm run test:e2e:keyboard` greps it out)
    // because a cold runner has never reached that state inside the budget;
    // `test.slow()` keeps a local run from tripping over the model download.
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
    // The button is `disabled={!modelsReady || isLoading}`, and a disabled
    // control swallows Enter silently — asserting only visibility let this pass
    // against a button that could not have started anything. Waiting for the
    // enabled state is what the test's own name claims: keyboard operability of
    // a live control, after the Whisper worker is ready.
    await expect(mic).toBeEnabled({ timeout: 60000 });
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

  test('pause and think-time report their pressed state', async ({ page }) => {
    // The AI-estimates toggle above already exposes aria-pressed; these two
    // were the outliers — stateful toggles a screen reader could only read as
    // plain buttons, whose labels change on activation. Activation is asserted
    // through a different channel than the attribute (Escape for pause, click
    // for think-time), so a stale aria-pressed cannot pass unnoticed.
    await loginAs(page);
    await page.goto('/interview?id=kbd-pressed&testMode=true');
    const bypass = page.getByRole('button', { name: /跳过语音测试/i });
    if (await bypass.isVisible({ timeout: 5000 }).catch(() => false)) {
      await bypass.click();
    }
    const enter = page.getByRole('button', { name: /开始面试|强制开始/i });
    await expect(enter).toBeEnabled({ timeout: 35000 });
    await enter.click();

    const pause = page.getByRole('button', { name: /暂停思考|恢复面试/ });
    await expect(pause).toBeVisible({ timeout: 15000 });
    await expect(pause).toHaveAttribute('aria-pressed', 'false');
    await page.keyboard.press('Escape');
    await expect(pause).toHaveAttribute('aria-pressed', 'true');
    await page.keyboard.press('Escape');
    await expect(pause).toHaveAttribute('aria-pressed', 'false');

    const think = page.getByRole('button', { name: /开启思考时间|关闭思考时间/ });
    await expect(think).toHaveAttribute('aria-pressed', 'false');
    await think.click();
    await expect(think).toHaveAttribute('aria-pressed', 'true');
  });
});
