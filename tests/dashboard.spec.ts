import { test, expect } from '@playwright/test';
import { loginAs } from './helpers';

test.describe('Dashboard Session Management', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page);
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');
  });

  test('should display dashboard title', async ({ page }) => {
    // Populated dashboard shows the console h1; fresh envs show the empty
    // state h2 instead. Either proves the page rendered for this user.
    await expect(
      page.getByRole('heading', { name: /Interve AI 控制台|Your Interview Journey Begins Here/ })
    ).toBeVisible();
  });

  test('should have a new interview entry point', async ({ page }) => {
    const headerLink = page.getByRole('link', { name: /New Mock Interview/i });
    const emptyCta = page.getByRole('button', { name: /Start Your First Mock Interview/i });
    await expect(headerLink.or(emptyCta)).toBeVisible();
    if (await headerLink.isVisible()) {
      await expect(headerLink).toHaveAttribute('href', '/setup');
    }
  });

  test('should show empty state or session history', async ({ page }) => {
    // Fresh environments (no Supabase data) render the empty state.
    const emptyHeading = page.getByRole('heading', { name: /Your Interview Journey Begins Here/i });
    const firstCta = page.getByRole('button', { name: /Start Your First Mock Interview/i });
    await expect(emptyHeading.or(page.getByText(/次已完成面试/))).toBeVisible();
    if (await emptyHeading.isVisible()) {
      await expect(firstCta).toBeVisible();
    }
  });
});
