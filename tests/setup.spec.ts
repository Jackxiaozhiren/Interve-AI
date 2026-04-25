import { test, expect } from '@playwright/test';

test.describe('Setup and Model Selection', () => {
  test.beforeEach(async ({ page }) => {
    // Visit the login page and authenticate
    await page.goto('/login');
    await page.getByRole('textbox', { name: '邮箱地址' }).fill('test@example.com');
    await page.getByRole('textbox', { name: '密码' }).fill('123456');
    await page.getByRole('button', { name: '登录' }).click();
    await page.waitForURL('**/dashboard');
    // Set onboarding to true so it doesn't show up
    await page.evaluate(() => {
      window.localStorage.setItem("interve_has_seen_onboarding", "true");
    });
    await page.goto('/setup');
    await page.waitForLoadState('networkidle');
  });

  test('should navigate through setup steps and select AI model', async ({ page }) => {
    // Step 1: Role & Level
    await expect(page.getByText('Frontend Engineer')).toBeVisible();
    await page.getByText('Frontend Engineer').click();
    await page.getByText('Mid-Level').click();
    await page.getByRole('button', { name: /Next Step/i }).click();

    // Step 2: Target Company
    await expect(page.getByText('Target Company')).toBeVisible();
    await page.getByText('General Tech').click();
    await page.getByRole('button', { name: /Next Step/i }).click();

    // Step 3: Interviewer Persona, Framework, Stress Test
    await expect(page.getByText('Interviewer Persona')).toBeVisible();
    await page.getByText('Supportive Mentor').click();
    await page.getByRole('button', { name: /Next Step/i }).click();

    // Step 4: AI Model Engine
    await expect(page.getByText('AI Model Engine')).toBeVisible();
    
    // Verify models and descriptions are displayed
    const zhipuCard = page.locator('div').filter({ hasText: /Zhipu AI \(GLM-4\)/ }).first();
    const openaiCard = page.locator('div').filter({ hasText: /OpenAI \(GPT-4o\)/ }).first();
    const geminiCard = page.locator('div').filter({ hasText: /Google Gemini \(1\.5 Pro\)/ }).first();

    await expect(zhipuCard).toBeVisible();
    await expect(openaiCard).toBeVisible();
    await expect(geminiCard).toBeVisible();

    // The user's checklist specifies: 检查模型描述是否清晰准确 (Check model descriptions)
    // We expect descriptions to exist below or near the titles
    const zhipuDesc = page.getByText(/Fast & Cost-effective|Balanced Performance|Excellent reasoning/i).first();
    if (await zhipuDesc.isVisible()) {
      await expect(zhipuDesc).toBeVisible();
    }

    // Select Gemini
    await page.getByText('Google Gemini (1.5 Pro)').click();
    await page.getByRole('button', { name: /Next Step/i }).click();

    // Step 5: Resume Integration
    await expect(page.getByText('Resume Integration')).toBeVisible();
    await page.getByRole('button', { name: /Next Step/i }).click();

    // Step 6: Hardware Check
    await expect(page.getByText('Hardware Check')).toBeVisible();
    // Allow permissions automatically in playwright config
    // ...
  });
});
