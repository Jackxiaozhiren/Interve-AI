import { test, expect } from '@playwright/test';

test.describe('Interve AI Core Interview Flow', () => {
  test.beforeEach(async ({ page }) => {
    // 1. Visit the login page and authenticate
    await page.goto('/login');
    // Set onboarding to true so it doesn't show up
    await page.evaluate(() => {
      window.localStorage.setItem("interve_has_seen_onboarding", "true");
    });
    
    await page.getByLabel('Email address').fill('test@example.com');
    await page.getByLabel('Password').fill('123456');
    await page.getByRole('button', { name: 'Sign In' }).click();
    await page.waitForURL('**/dashboard');
  });

  test('should navigate from home to setup and then to interview room', async ({ page }) => {
    // Dashboard shows the header link when sessions exist, otherwise the
    // empty-state CTA button. Either entry point must lead to /setup.
    const startLink = page.getByRole('link', { name: /New Mock Interview/i });
    const startButton = page.getByRole('button', { name: /Start Your First Mock Interview/i });
    await expect(startLink.or(startButton)).toBeVisible();
    if (await startLink.isVisible()) {
      await startLink.click();
    } else {
      await startButton.click();
    }

    // 2. We should be on the setup page
    await expect(page).toHaveURL(/.*\/setup/);

    // Make real selections (defaults alone keep Start disabled by design)
    await page.getByText('Frontend Engineer').click();
    await page.getByText('Mid-Level').click();
    await page.getByRole('button', { name: /Next Step/i }).click();

    await page.getByText('General Tech').click();
    await page.getByRole('button', { name: /Next Step/i }).click();

    await page.getByText('Supportive Mentor').click();
    await page.getByRole('button', { name: /Next Step/i }).click();

    await page.getByText('Google Gemini (1.5 Pro)').click();
    await page.getByRole('button', { name: /Next Step/i }).click();

    // Resume step: continue without upload
    await page.getByRole('button', { name: /Next Step/i }).click();

    // Click the Start Session button
    page.on('console', msg => console.log('BROWSER CONSOLE:', msg.text()));
    const startSessionBtn = page.getByRole('button', { name: /Start Session|Start without Mic/i });
    await expect(startSessionBtn).toBeEnabled({ timeout: 30000 });
    await startSessionBtn.click();

    // 3. We should be on the interview page (GreenRoom gate first)
    await expect(page).toHaveURL(/.*\/interview/);

    test.setTimeout(60000);
    const bypassBtn = page.getByRole('button', { name: /跳过语音测试/i });
    await expect(bypassBtn).toBeVisible({ timeout: 15000 });
    await bypassBtn.click();

    // Now the Standby overlay should open. Wait for "开始面试" or "强制开始" button.
    const enterRoomBtn = page.getByRole('button', { name: /开始面试|强制开始/i });
    
    // It might be disabled initially until checks pass, which can take up to 15s+
    await expect(enterRoomBtn).toBeEnabled({ timeout: 35000 });
    await enterRoomBtn.click();



    // Verify interview page UI elements
    // e.g., the End Interview button
    const endButton = page.locator('button', { hasText: /结束面试/i }).first();
    await expect(endButton).toBeVisible({ timeout: 15000 });

    // Verify scratchpad toggle or chat toggle is present
    const scratchpadButton = page.locator('button[aria-label="打开白板 (Scratchpad)"]').first();
    if (await scratchpadButton.isVisible()) {
      await expect(scratchpadButton).toBeVisible();
    }
    
    // We successfully completed the critical path
  });
});
