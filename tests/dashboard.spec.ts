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

test.describe("Dashboard launcher pages navigate instead of sitting inert", () => {
  // /dashboard/interview and /dashboard/resume rendered buttons with no
  // handler, no form and no link behind them — including a 选择文件 button on a
  // page titled 上传简历文件, whose dropzone discarded whatever was dropped on it.
  // The `debt.deadControls` ratchet catches that shape statically; these assert
  // the behaviour the fix replaced it with.
  test("the interview hall's cards route to real destinations", async ({ page }) => {
    await loginAs(page);
    await page.goto("/dashboard/interview");
    await page.waitForLoadState("networkidle");

    // Scoped to <main>: the top nav also carries a 开始面试 → /setup link, so an
    // unscoped locator resolves to two elements and proves nothing about the card.
    const main = page.getByRole("main");
    await expect(main.getByRole("link", { name: "开始面试" })).toHaveAttribute("href", "/setup");
    await main.getByRole("link", { name: "前往控制台" }).click();
    await expect(page).toHaveURL(/\/dashboard$/);
  });

  test("the sidebar reaches both launcher pages", async ({ page }) => {
    // "My Interviews" pointed at /dashboard — the same route as the row above it
    // — so the hall page had no way in from the product at all, and
    // /dashboard/resume had none either. The static rule in anchor-integrity
    // names that shape; this proves the click actually lands.
    await loginAs(page);
    await page.goto("/dashboard");
    await page.waitForLoadState("networkidle");

    await page.getByRole("link", { name: "My Interviews" }).click();
    await expect(page).toHaveURL(/\/dashboard\/interview$/);

    await page.getByRole("main").getByRole("link", { name: "前往简历分析" }).click();
    await expect(page).toHaveURL(/\/dashboard\/resume$/);
    await expect(page.getByRole("heading", { name: "上传简历文件" })).toBeVisible();
  });

  test("the resume page points at the step that actually parses a file", async ({ page }) => {
    await loginAs(page);
    await page.goto("/dashboard/resume");
    await page.waitForLoadState("networkidle");

    // This copy used to render the literal text "{MAX_RESUME_MB}MB": it was a
    // plain string, not a template, so the bound the page promised was noise.
    await expect(page.locator("main")).not.toContainText("{MAX_RESUME_MB}");
    await expect(page.getByText(/最大 5MB/)).toBeVisible();

    await page.getByRole("link", { name: "前往面试准备向导" }).click();
    await expect(page).toHaveURL(/\/setup/);
  });
});
