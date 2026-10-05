import { test, expect } from '@playwright/test';
import { loginAs } from './helpers';

/**
 * The disclosure itself, in a browser, not only in the AST.
 *
 * `clipboard-ownership.test.ts` proves no site can announce a copy it never
 * confirmed. This file proves the other half: when the browser refuses the
 * write, the user is told so, the selection is not thrown away, and nothing
 * throws. A rejected `writeText()` and an absent `navigator.clipboard` are
 * both ordinary conditions (unfocused document, insecure context), and the
 * old code announced success in each of them.
 *
 * Runs in the smoke lane against a stubbed clipboard only — no network, no
 * provider call, no key.
 */
function stubClipboard(mode: 'rejects' | 'resolves' | 'absent') {
  if (mode === 'rejects') {
    return () => {
      Object.defineProperty(navigator, 'clipboard', {
        configurable: true,
        get: () => ({ writeText: () => Promise.reject(new DOMException('denied', 'NotAllowedError')) }),
      });
    };
  }
  if (mode === 'resolves') {
    return () => {
      Object.defineProperty(navigator, 'clipboard', {
        configurable: true,
        get: () => ({ writeText: () => Promise.resolve() }),
      });
    };
  }
  return () => {
    Object.defineProperty(navigator, 'clipboard', { configurable: true, get: () => undefined });
  };
}

async function selectHeading(page: import('@playwright/test').Page) {
  await page.evaluate(() => {
    const el = Array.from(document.querySelectorAll('h2')).find((h) => h.textContent?.includes('Target Role'));
    if (!el) throw new Error('heading not found');
    const range = document.createRange();
    range.selectNodeContents(el);
    const sel = window.getSelection();
    sel?.removeAllRanges();
    sel?.addRange(range);
    document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
  });
  await expect(page.locator('#text-selection-menu')).toBeVisible();
}

test.describe('clipboard disclosure on /setup', () => {
  test('a refused write is reported as a failure and the selection survives', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    await loginAs(page);
    await page.addInitScript(stubClipboard('rejects'));
    await page.goto('/setup');
    await selectHeading(page);
    await page.locator('#text-selection-menu').getByRole('button', { name: 'Copy' }).click();
    await expect(page.getByText('Copy failed')).toBeVisible();
    await expect(page.getByText('Copied to clipboard')).toHaveCount(0);
    await expect(page.locator('#text-selection-menu')).toBeVisible();
    expect(errors).toEqual([]);
  });

  test('a successful write still says so', async ({ page }) => {
    await loginAs(page);
    await page.addInitScript(stubClipboard('resolves'));
    await page.goto('/setup');
    await selectHeading(page);
    await page.locator('#text-selection-menu').getByRole('button', { name: 'Copy' }).click();
    await expect(page.getByText('Copied to clipboard')).toBeVisible();
    await expect(page.getByText('Copy failed')).toHaveCount(0);
  });

  test('no clipboard surface at all does not throw', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    await loginAs(page);
    await page.addInitScript(stubClipboard('absent'));
    await page.goto('/setup');
    await selectHeading(page);
    await page.locator('#text-selection-menu').getByRole('button', { name: 'Copy' }).click();
    await page.waitForTimeout(1200);
    expect(errors).toEqual([]);
    const copyFailed = await page.getByText('Copy failed').count();
    const copied = await page.getByText('Copied to clipboard').count();
    expect(copyFailed + copied).toBe(1);
  });
});
