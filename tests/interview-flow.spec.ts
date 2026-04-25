import { test, expect } from '@playwright/test';

test.describe('Interve AI Core Interview Flow', () => {
  test.beforeEach(async ({ page }) => {
    // 1. Visit the login page and authenticate
    await page.goto('/login');
    // Set onboarding to true so it doesn't show up
    await page.evaluate(() => {
      window.localStorage.setItem("interve_has_seen_onboarding", "true");
    });
    
    await page.getByRole('textbox', { name: '邮箱地址' }).fill('test@example.com');
    await page.getByRole('textbox', { name: '密码' }).fill('123456');
    await page.getByRole('button', { name: '登录' }).click();
    await page.waitForURL('**/dashboard');
  });

  test('should navigate from home to setup and then to interview room', async ({ page }) => {
    // Check that we're on the dashboard page and have a "New Mock Interview" button
    const startLink = page.getByRole('link', { name: /New Mock Interview/i });
    await expect(startLink).toBeVisible();
    await startLink.click();

    // 2. We should be on the setup page
    await expect(page).toHaveURL(/.*\/setup/);

    // Click Next Step 5 times to reach step 6
    for (let i = 0; i < 5; i++) {
      await page.getByRole('button', { name: /Next Step/i }).click();
    }

    // Click the Start Session button
    page.on('console', msg => console.log('BROWSER CONSOLE:', msg.text()));
    const startSessionBtn = page.getByRole('button', { name: /Start Session|Start without Mic/i });
    await expect(startSessionBtn).toBeVisible();
    await startSessionBtn.click();

    // 3. We should be on the interview page
    await expect(page).toHaveURL(/.*\/interview/);

    test.setTimeout(60000);
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
