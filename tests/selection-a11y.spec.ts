import { test, expect } from '@playwright/test';
import { loginAs } from './helpers';

/**
 * The wizard's cards, announced.
 *
 * `tests/unit/selection-state.test.ts` proves every selection-painting button
 * carries an accessible state attribute. That is not the same as the attribute
 * being *right*: an `aria-pressed={someUnrelatedThing}` would satisfy the AST
 * and lie to a screen reader. This file drives the real page and asserts the
 * press moves with the choice.
 *
 * Clicks are re-armed until the state changes — a cold route serves SSR HTML
 * before React attaches its handlers, so the first click can land on nothing.
 */
async function clickUntilPressed(card: import('@playwright/test').Locator) {
  await expect
    .poll(
      async () => {
        await card.click();
        return (await card.getAttribute('aria-pressed')) === 'true';
      },
      { timeout: 30000, message: 'aria-pressed never became true after clicking the card' },
    )
    .toBe(true);
}

function roleSection(page: import('@playwright/test').Page) {
  return page.locator('section').filter({ has: page.getByRole('heading', { name: 'Target Role' }) }).first();
}

test.describe('selection state on /setup', () => {
  test('the press follows the choice instead of sticking to the default', async ({ page }) => {
    await loginAs(page);
    await page.goto('/setup');

    // The wizard opens with a role and a level already chosen, so the honest
    // baseline is that the default card reports pressed.
    const frontend = page.getByRole('button', { name: 'Frontend Engineer' }).first();
    const backend = page.getByRole('button', { name: 'Backend Engineer' }).first();
    await expect(frontend).toHaveAttribute('aria-pressed', 'true');
    await expect(backend).toHaveAttribute('aria-pressed', 'false');

    await clickUntilPressed(backend);
    await expect(frontend).toHaveAttribute('aria-pressed', 'false');

    // Two groups in this section (roles, levels), so exactly two presses total.
    await expect(roleSection(page).locator('[aria-pressed="true"]')).toHaveCount(2);
  });

  test('the level pills expose which one is chosen', async ({ page }) => {
    await loginAs(page);
    await page.goto('/setup');
    const mid = page.getByRole('button', { name: 'Mid-Level' }).first();
    await expect(mid).toHaveAttribute('aria-pressed', 'true');

    const senior = page.getByRole('button', { name: 'Senior' }).first();
    await clickUntilPressed(senior);
    await expect(mid).toHaveAttribute('aria-pressed', 'false');
  });
});
