import { test, expect } from '@playwright/test';

test.describe('Interview Setup and Room', () => {
  test('should load the setup page', async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem("interve_auth_user", JSON.stringify({ id: "test", email: "test@example.com", name: "Test User" }));
      window.localStorage.setItem("interve_has_seen_onboarding", "true");
    });
    await page.goto('/setup');
    
    // Check if the role selection is visible
    await expect(page.getByText('Target Role')).toBeVisible();
    await expect(page.getByText('Frontend Engineer')).toBeVisible();
  });
  
  test('should navigate to interview room when Start is clicked', async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem("interve_auth_user", JSON.stringify({ id: "test", email: "test@example.com", name: "Test User" }));
      window.localStorage.setItem("interve_has_seen_onboarding", "true");
    });
    await page.goto('/setup');
    
    // Click Next Step 5 times to reach step 6
    for (let i = 0; i < 5; i++) {
      await page.getByRole('button', { name: /Next Step/i }).click();
    }
    
    const startBtn = page.getByRole('button', { name: /Start Session|Start without Mic/i });
    await expect(startBtn).toBeVisible();
    await startBtn.click();
    
    test.setTimeout(60000);
    // Now the Standby overlay should open. Wait for "开始面试" or "强制开始" button.
    const enterRoomBtn = page.getByRole('button', { name: /开始面试|强制开始/i });
    await expect(enterRoomBtn).toBeEnabled({ timeout: 35000 });
    await enterRoomBtn.click();
    
    // Wait for URL to change to interview
    await expect(page).toHaveURL(/.*\/interview/);
    
    // Ensure End Interview button is present
    await expect(page.getByRole('button', { name: /结束面试|End Interview/i })).toBeVisible({ timeout: 30000 });
  });
});
