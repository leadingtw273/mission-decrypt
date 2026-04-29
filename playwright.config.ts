import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  retries: 0,
  use: {
    baseURL: 'http://localhost:5180',
    trace: 'retain-on-failure',
  },
  expect: {
    toHaveScreenshot: {
      // Tiny anti-aliasing flicker (a handful of pixels per shot) creeps in
      // between runs; tolerate a sub-percent diff so the suite isn't flaky.
      maxDiffPixelRatio: 0.005,
    },
  },
  webServer: {
    command: 'pnpm dev --port 5180 --strictPort',
    url: 'http://localhost:5180',
    reuseExistingServer: !process.env.CI,
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
  ],
});
