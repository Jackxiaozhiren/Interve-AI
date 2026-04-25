import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:3000',
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
    return generatedProjects;
  })(),

  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 180 * 1000,
  },
});
