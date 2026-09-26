import { test, expect } from '@playwright/test';
import { loginAs } from './helpers';

// fixme, re-adjudicated 2026-09-26 — the original reason is now false. It
// claimed this suite needs "provider keys plus a deterministic AI stub for CI";
// the stub exists (`AI_MOCK=1`, and `npm run test:e2e:mock` passes the whole
// journey keylessly in ~50s). What actually blocks it:
//   1. Reaching the interview room needs the in-memory PostgREST stub, which is
//      72 lines private to tests/mock-journey.spec.ts. Extract it into
//      tests/helpers.ts and this suite can run in the mock lane.
//   2. "should display Markdown correctly" is vacuous: `if (await
//      codeBlock.isVisible()) { expect(...).toBeVisible() }` cannot fail. It
//      needs a real assertion against the canned mock reply, not a restore.
//   3. Neither of the other two has ever executed, so their locators and the
//      1500-char round trip are unverified assumptions, not known-good tests.
// So: two tests to prove and one to rewrite. Not dead because of keys.
test.describe.fixme('Chat Interface', () => {
  test.describe.configure({ timeout: 60000 });

  test.beforeEach(async ({ page }) => {
    await loginAs(page);
    await page.goto('/interview?id=test-session-123&role=frontend&level=Mid-Level&persona=supportive&aiModel=zhipu&testMode=true');
    page.on('console', msg => console.log('BROWSER CONSOLE:', msg.text()));
    page.on('pageerror', error => console.log('BROWSER ERROR:', error.message));
    
    // Bypass standby overlay
    const enterRoomBtn = page.getByRole('button', { name: /开始面试|强制开始/i });
    await expect(enterRoomBtn).toBeEnabled({ timeout: 35000 });
    await enterRoomBtn.click();
  });

  test('should send normal text message and receive response', async ({ page }) => {
    const input = page.locator('input[type="text"]');
    await expect(input).toBeVisible();

    await input.fill('Hello, I am ready for the interview.');
    await input.press('Enter');

    // Verify user message appears
    await expect(page.getByText('Hello, I am ready for the interview.')).toBeVisible();

    // Verify AI responds (we can't predict exact text, but a response bubble should appear)
    const aiMessages = page.locator('.prose'); // Assuming markdown prose is used for AI
    await expect(aiMessages.first()).toBeVisible({ timeout: 15000 });
  });

  test('should handle long text messages', async ({ page }) => {
    const input = page.locator('input[type="text"]');
    const longText = 'A'.repeat(1500); // > 1000 chars
    await input.fill(longText);
    await input.press('Enter');

    // Since long text may wrap, we check if it's in the DOM
    await expect(page.locator(`text=${longText}`)).toBeVisible();
  });

  test('should display Markdown correctly', async ({ page }) => {
    const input = page.locator('input[type="text"]');
    await input.fill('Please provide an example in Markdown with a list and code block.');
    await input.press('Enter');

    // Wait for AI response
    await page.waitForTimeout(5000);
    // UI might have code blocks
    const codeBlock = page.locator('pre code');
    if (await codeBlock.isVisible()) {
      await expect(codeBlock).toBeVisible();
    }
  });
});
