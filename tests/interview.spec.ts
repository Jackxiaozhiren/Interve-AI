import { test, expect } from '@playwright/test';
import { loginAs } from './helpers';

test.describe('Interview Setup and Room', () => {
  test('should load the setup page', async ({ page }) => {
    await loginAs(page);
    await page.goto('/setup');
    
    // Check if the role selection is visible
    await expect(page.getByText('Target Role')).toBeVisible();
    await expect(page.getByText('Frontend Engineer')).toBeVisible();
  });
  
  test('should navigate to interview room when Start is clicked', async ({ page }) => {
    await loginAs(page);
    await page.goto('/setup');

    // Make the same real selections as a user would (leaving everything
    // default keeps Start disabled, which is the product's guard).
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

    const startBtn = page.getByRole('button', { name: /Start Session|Start without Mic/i });
    await expect(startBtn).toBeEnabled({ timeout: 30000 });
    await startBtn.click();
    
    test.setTimeout(60000);
    // 3. We should be on the interview page (GreenRoom gate first)
    await expect(page).toHaveURL(/.*\/interview/);
    const bypassBtn = page.getByRole('button', { name: /跳过语音测试/i });
    await expect(bypassBtn).toBeVisible({ timeout: 15000 });
    await bypassBtn.click();

    // Now the Standby overlay should open. Wait for "开始面试" or "强制开始" button.
    const enterRoomBtn = page.getByRole('button', { name: /开始面试|强制开始/i });
    await expect(enterRoomBtn).toBeEnabled({ timeout: 35000 });
    await enterRoomBtn.click();
    
    // Ensure End Interview button is present
    await expect(page.getByRole('button', { name: /结束面试|End Interview/i })).toBeVisible({ timeout: 30000 });
  });
});
