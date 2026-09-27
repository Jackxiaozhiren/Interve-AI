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

// Regression: OnboardingTour is mounted by dashboard-shell, so for a user who
// never finished it the overlay re-appeared on EVERY /dashboard/* route —
// including the Privacy Center, where its fixed inset-0 layer covered the
// delete-session button and turned a click into a 180s actionability timeout
// (first seen on a CI runner via tests/mock-journey.spec.ts:169).
test.describe('Onboarding tour scope', () => {
  test('never covers a dashboard sub-route', async ({ page }) => {
    await loginAs(page);
    // loginAs marks onboarding as seen; un-mark it to model a first-run user.
    await page.addInitScript(() => localStorage.removeItem('interve_has_seen_onboarding'));
    await page.goto('/dashboard/privacy');
    // The tour reveals itself 1s after mount, so any shorter wait proves nothing.
    await page.waitForTimeout(2500);
    await expect(
      page.getByRole('dialog', { name: /Welcome to Interve AI|Mock Interviews|Analytics/ })
    ).toBeHidden();
  });

  // Counter-pin: scoping the tour away from sub-routes must not quietly delete
  // onboarding. A first-run user on the dashboard index still gets it.
  test('still appears on the dashboard index for a first-run user', async ({ page }) => {
    await loginAs(page);
    await page.addInitScript(() => localStorage.removeItem('interve_has_seen_onboarding'));
    await page.goto('/dashboard');
    const tour = page.getByRole('dialog', { name: /Welcome to Interve AI|Mock Interviews|Analytics/ });
    await expect(tour).toBeVisible({ timeout: 15000 });
    await expect(tour.getByRole('button', { name: 'Next' })).toBeVisible();
  });
});
