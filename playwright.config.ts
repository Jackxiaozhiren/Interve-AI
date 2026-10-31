import { defineConfig, devices } from '@playwright/test';

/**
 * The origin specs navigate to. Owned here and imported by tests/helpers.ts,
 * which has to set an HttpOnly cookie before the first navigation — at that
 * point page.url() is still about:blank, so the helper cannot derive the origin
 * from the page and must not grow its own copy of this string.
 */
export const BASE_URL = 'http://localhost:3000';

export default defineConfig({
  testDir: './tests',
  // Phase 2: only Playwright specs. vitest owns tests/unit + tests/integration
  // (*.test.ts) — without this, each runner executes the other's files.
  testMatch: ['**/*.spec.ts'],
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
  },
  timeout: 60000,
  expect: {
    timeout: 15000,
  },

  projects: (() => {
    const resolutions = [
      { width: 1280, height: 720 },
      { width: 1440, height: 900 },
      { width: 1920, height: 1080 },
    ];
    const browsers = [
      { name: 'chrome', use: { ...devices['Desktop Chrome'], channel: 'chrome' } },
      { name: 'edge', use: { ...devices['Desktop Edge'], channel: 'msedge' } },
      { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
      { name: 'safari', use: { ...devices['Desktop Safari'] } },
    ];

    const generatedProjects = [];
    for (const browser of browsers) {
      for (const res of resolutions) {
        generatedProjects.push({
          name: `${browser.name}-${res.width}x${res.height}`,
          // The phone geometry spec belongs to its own project. Without this the
          // desktop lanes collect it too and assert a 390px layout at 1280px,
          // which passes for the wrong reason and says nothing.
          testIgnore: /phone-width\.spec\.ts/,
          use: {
            ...browser.use,
            viewport: res,
            ...( (browser.name === 'chrome' || browser.name === 'edge') ? { permissions: ['microphone', 'camera'] } : {} ),
            launchOptions: (browser.name === 'chrome' || browser.name === 'edge') ? {
              args: [
                '--use-fake-ui-for-media-stream',
                '--use-fake-device-for-media-stream',
              ],
            } : (browser.name === 'firefox' ? {
              firefoxUserPrefs: {
                'media.navigator.streams.fake': true,
                'media.navigator.permission.disabled': true,
              }
            } : undefined),
          },
        });
      }
    }
    // The rank-1 audience opens this on a phone, and no project above models one:
    // three desktop widths across four browsers still cannot answer "does it fit
    // in 390px". Scoped to the geometry spec so the visual lanes keep their
    // existing baselines rather than growing a phone image per route.
    generatedProjects.push({
      name: 'phone-390x844',
      use: { ...devices['Pixel 7'], viewport: { width: 390, height: 844 } },
      testMatch: /phone-width\.spec\.ts/,
    });
    return generatedProjects;
  })(),

  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 180 * 1000,
    // Phase 14: mock-journey lane. E2E_MOCK=1 boots the SAME dev server
    // with deterministic AI (AI_MOCK=1); all other suites are unaffected.
    env: process.env.E2E_MOCK ? { AI_MOCK: '1' } : {},
  },
});
