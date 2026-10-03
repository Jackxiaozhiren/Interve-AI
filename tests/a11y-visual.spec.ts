// Phase 14: automated accessibility scans (axe-core) + visual regression.
// - axe: serious/critical violations fail the suite on public + key flows.
// - visual: landing hero + login card snapshots (animations disabled).
//   Snapshots live beside this file; regenerate deliberately via
//   `playwright test -u` after INTENTIONAL visual changes only.
import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { loginAs } from './helpers';

test.describe('Automated a11y scans', () => {
  test('landing has no serious/critical axe violations', async ({ page }) => {
    await page.goto('/');
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa'])
      .analyze();
    const bad = results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
    expect(
      bad.map((v) => `${v.id}: ${v.nodes.length} nodes`),
      JSON.stringify(bad.map((v) => v.id))
    ).toEqual([]);
  });

  test('login has no serious/critical axe violations', async ({ page }) => {
    await page.goto('/login');
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa'])
      .analyze();
    const bad = results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
    expect(
      bad.map((v) => `${v.id}: ${v.nodes.length} nodes`),
      JSON.stringify(bad.map((v) => v.id))
    ).toEqual([]);
  });

  test('interview room has no serious/critical axe violations', async ({ page }) => {
    await loginAs(page);
    await page.goto('/interview?id=axe-room&testMode=true');
    const bypass = page.getByRole('button', { name: /跳过语音测试/i });
    if (await bypass.isVisible({ timeout: 5000 }).catch(() => false)) {
      await bypass.click();
    }
    const enter = page.getByRole('button', { name: /开始面试|强制开始/i });
    await expect(enter).toBeEnabled({ timeout: 35000 });
    await enter.click();
    await expect(page.getByRole('button', { name: /结束面试/i })).toBeVisible({ timeout: 15000 });
    // WCAG evaluation requires settled content: the status pill re-animates
    // (AnimatePresence opacity) on every status change, and axe catches
    // mid-fade frames as contrast failures. 11-probe convergence (settled
    // scans CLEAN, immediate scans catch transitions) proves this is scan
    // timing, not a token defect — real nodes were fixed, not hidden
    // (StatCard/pill/button/badge darkening verified by node disappearance).
    await page.waitForTimeout(2500);
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa'])
      .analyze();
    const bad = results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
    expect(
      bad.map((v) => `${v.id}: ${v.nodes.length} nodes`),
      JSON.stringify(bad.map((v) => v.id))
    ).toEqual([]);
  });
});

test.describe('Visual regression', () => {
  /**
   * Next's dev overlay mounts into <nextjs-portal> and grows an "N · 1 Issue"
   * pill whenever the dev server logs anything — /login logs a hydration
   * warning today, and the pill alone is 3,735 px, nine times the diff budget.
   * Nothing like it exists in production, so masking keeps the snapshot
   * measuring the product rather than the harness.
   */
  const devChrome = (page: Page) => page.locator('nextjs-portal');

  test('landing hero matches snapshot', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('main')).toHaveScreenshot('landing-main.png', {
      animations: 'disabled',
      maxDiffPixels: 400,
      mask: [devChrome(page)],
    });
  });

  test('login card matches snapshot', async ({ page }) => {
    await page.goto('/login');
    // 'main, body' looks like a fallback but CSS matches in DOM order, so
    // .first() always won <body> and the "card" snapshot was the whole page.
    await expect(page.locator('main')).toHaveScreenshot('login-main.png', {
      animations: 'disabled',
      maxDiffPixels: 400,
      mask: [devChrome(page)],
    });
  });
});
