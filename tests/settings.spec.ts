import { test, expect } from '@playwright/test';

test.describe('Settings Interface', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem("interve_auth_user", JSON.stringify({ id: "test", email: "test@example.com", name: "Test User" }));
      window.localStorage.setItem("interve_has_seen_onboarding", "true");
    });
    await page.goto('/dashboard/settings');
    await page.waitForLoadState('networkidle');
  });

  test('should display Profile Information correctly', async ({ page }) => {
    // Verify headings
    await expect(page.getByText('Profile Information')).toBeVisible();
    
    // Verify inputs exist
    const firstNameInput = page.locator('input#firstName');
    const lastNameInput = page.locator('input#lastName');
    const emailInput = page.locator('input#email');
    const bioTextarea = page.locator('textarea#bio');

    await expect(firstNameInput).toBeVisible();
    await expect(lastNameInput).toBeVisible();
    await expect(emailInput).toBeVisible();
    await expect(bioTextarea).toBeVisible();
  });

  test('should allow editing profile information', async ({ page }) => {
    const firstNameInput = page.locator('input#firstName');
    
    // Clear and fill
    await firstNameInput.fill('');
    await firstNameInput.fill('John');
    
    // Check if Save Profile button exists
    const saveBtn = page.getByRole('button', { name: /Save Profile/i });
    await expect(saveBtn).toBeVisible();
  });

  test('should display Notifications and Account Security sections', async ({ page }) => {
    await expect(page.getByText('Notifications', { exact: true })).toBeVisible();
    await expect(page.getByText('Email Notifications')).toBeVisible();
    
    await expect(page.getByText('Account Security', { exact: true })).toBeVisible();
    await expect(page.getByText('Change Password')).toBeVisible();
    await expect(page.getByRole('button', { name: /Sign Out All/i })).toBeVisible();
  });
});
