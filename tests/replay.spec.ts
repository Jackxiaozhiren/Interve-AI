import { test, expect } from '@playwright/test';

test.describe('Replay Page', () => {
  test('should show Interview Not Found for non-existent session', async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem("interve_auth_user", JSON.stringify({ id: "test", email: "test@example.com", name: "Test User" }));
      window.localStorage.setItem("interve_has_seen_onboarding", "true");
    });
    // Navigate to a non-existent replay ID
    await page.goto('/dashboard/replay/999999');
    
    // The page should load and eventually display "Interview Not Found"
    await expect(page.getByText('Interview Not Found')).toBeVisible();
    
    // There should be a "Return to Dashboard" button
    const returnBtn = page.getByRole('button', { name: /Return to Dashboard/i });
    await expect(returnBtn).toBeVisible();
    
    // Click the return button and verify navigation
    await returnBtn.click();
    await expect(page).toHaveURL(/.*\/dashboard/);
  });
});
