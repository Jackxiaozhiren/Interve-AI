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

  test('the data strip admits it cannot know anything about a signed-out visitor', async ({ page }) => {
    // The numbers here come from the account's rows, and an anonymous read
    // answers `[]` — which used to render as "本地模拟面试 0" under a hint saying
    // the data was local and never uploaded. Both halves were false
    // (tests/unit/no-unverifiable-claims.test.ts owns the reason), so assert what
    // a stranger is actually shown, in the rendered DOM rather than the source.
    await page.goto('/');
    const strip = page.locator('section[aria-label="数据概览"]');
    await expect(strip).toBeVisible();

    const text = await strip.innerText();
    expect(text, `rendered: ${text}`).toMatch(/登录后查看/);
    // No digits: the count and the rate are placeholders, not a computed zero.
    expect(text, `rendered: ${text}`).not.toMatch(/\d/);
    expect(text, `rendered: ${text}`).not.toMatch(/IndexedDB|localStorage|Dexie|无需上传|本地模拟面试/);
  });
});
