// Phase 2: local landing smoke (replaces the create-playwright scaffold that
// tested https://playwright.dev/ — zero product value and network-dependent).
import { test, expect } from '@playwright/test';

test.describe('Landing', () => {
  test('should render hero and primary CTAs', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await expect(page.getByRole('link', { name: /免费开始|Sign up/i }).first()).toBeVisible();
  });

  test('login page should render the sign-in form', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByLabel('Email address')).toBeVisible();
    await expect(page.getByLabel('Password')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Sign In' })).toBeVisible();
  });
});
