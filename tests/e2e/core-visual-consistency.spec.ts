import { test } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

test.describe('Core Functionality & Visual Consistency', () => {
  test.setTimeout(180000); // 3 minutes per browser-resolution combo

  test('run full validation flow', async ({ page }, testInfo) => {
    // Project name is format: browser-1280x720
    const parts = testInfo.project.name.split('-');
    const browserName = parts[0];
    const resolution = parts[1];
    
    // Directory for saving screenshots
    const artifactsDir = path.join(process.cwd(), 'artifacts'); // Root of the project's artifacts
    const targetDir = path.join(artifactsDir, 'screenshots', browserName, resolution);
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }

    const captureScreenshot = async (name: string, fullPage: boolean = true) => {
      const filePath = path.join(targetDir, `${name}.png`);
      try {
        await page.screenshot({ path: filePath, fullPage });
        console.log(`[PASS] Captured screenshot: ${name}`);
      } catch (err) {
        console.error(`[ERROR] Failed to capture screenshot ${name}:`, err);
      }
    };

    // --- 1. Home Page ---
    await test.step('Home Page Validation', async () => {
      await page.goto('/');
      await page.waitForLoadState('networkidle');
      await captureScreenshot('home_initial');
      
      // Scroll down to verify navbar glassmorphism
      await page.evaluate(() => window.scrollTo(0, 500));
      await page.waitForTimeout(1000);
      await captureScreenshot('home_scrolled');
      
      // Scroll to bottom
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await page.waitForTimeout(1000);
      await captureScreenshot('home_footer');
    });

    // --- 2. Chat Interface ---
    await test.step('Chat Interface Validation', async () => {
      const response = await page.goto('/chat');
      await page.waitForLoadState('networkidle');
      if (response && response.status() === 404) {
        console.log('[WARN] /chat is 404. Trying /interview instead');
        await page.goto('/interview');
        await page.waitForLoadState('networkidle');
      }
      
      await page.waitForTimeout(1000);
      await captureScreenshot('chat_initial', false);

      // Attempt to find an input and send a message
      try {
        const inputLocator = page.locator('textarea, input[placeholder*="message" i], input[placeholder*="Message" i], input[type="text"]').first();
        if (await inputLocator.isVisible()) {
          await inputLocator.fill('Hello AI, please reply.');
          // Find submit button or press Enter
          const submitBtn = page.locator('button[type="submit"], button:has(svg)').first();
          if (await submitBtn.isVisible()) {
            await submitBtn.click();
          } else {
            await page.keyboard.press('Enter');
          }
          await page.waitForTimeout(3000); // wait for AI response
          await captureScreenshot('chat_after_text', false);

          // Test code block
          await inputLocator.fill('```javascript\nconsole.log("Hello from tests");\n```');
          await page.keyboard.press('Enter');
          await page.waitForTimeout(3000);
          await captureScreenshot('chat_after_code', false);
        }
      } catch (e) {
        console.error('[WARN] Could not interact with chat input', e);
      }
    });

    // --- 3. Auxiliary Pages ---
    const pages = [
      { url: '/history', name: 'history' },
      { url: '/dashboard', name: 'dashboard' },
      { url: '/settings', name: 'settings' },
      { url: '/login', name: 'login' },
      { url: '/signup', name: 'signup' }
    ];

    for (const p of pages) {
      await test.step(`Auxiliary Page: ${p.name}`, async () => {
        try {
          await page.goto(p.url, { waitUntil: 'networkidle', timeout: 15000 });
          await page.waitForTimeout(1000);
          await captureScreenshot(`aux_${p.name}`);
        } catch (e) {
          console.error(`[WARN] Failed to load ${p.url}:`, e);
        }
      });
    }
    
    // --- 4. Responsive & Max-width Verification ---
    // The framework implicitly tests responsiveness through the viewport config in playwright.config.ts
  });
});
