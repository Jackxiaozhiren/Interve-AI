// Phase 10: Privacy Center e2e (works without Supabase: inventory and
// controls render; empty DB shows the empty state, never a spinner trap).
import { test, expect } from '@playwright/test';
import { loginAs } from './helpers';

test.describe('Privacy Center', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page);
    await page.goto('/dashboard/privacy');
  });

  test('should show the data inventory', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /Privacy Center/ })).toBeVisible();
    await expect(page.getByText('Raw microphone audio')).toBeVisible();
    await expect(page.getByText('Camera video / frames')).toBeVisible();
    await expect(page.getByText('Not stored (default)').first()).toBeVisible();
  });

  test('should expose export and danger-zone controls', async ({ page }) => {
    await expect(page.getByRole('button', { name: /导出我的全部数据/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /清理本机快照与草稿/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /永久删除全部云端数据/ })).toBeDisabled();
    // Danger zone requires explicit confirmation.
    await page.getByRole('checkbox').check();
    await expect(page.getByRole('button', { name: /永久删除全部云端数据/ })).toBeEnabled();
  });

  test('should be reachable from the dashboard sidebar', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page.getByRole('link', { name: /Privacy/ })).toBeVisible();
  });
});
