import { defineConfig, devices } from '@playwright/test';

// The suite drives a throwaway stack (see tools/stack.mjs) unless E2E_BASE_URL points at one you started yourself.
const port = Number(process.env.E2E_PORT || 18080);
const external = Boolean(process.env.E2E_BASE_URL);
const baseURL = (process.env.E2E_BASE_URL || `http://127.0.0.1:${port}`).replace(/\/$/, '');
// Playwright wants the Chromium revision it ships with. Without that download, point at any recent Chrome / Chromium.
const executablePath = process.env.E2E_CHROMIUM_PATH || undefined;

export default defineConfig({
  testDir: './specs',
  outputDir: './test-results',
  timeout: 90_000,
  expect: { timeout: 10_000 },
  // One backend, one database, specs that change data: run files one after another, in file-name order.
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [
    ['list'],
    ['html', { open: 'never', outputFolder: 'playwright-report' }],
    ['json', { outputFile: 'test-results/results.json' }],
  ],
  globalSetup: './global-setup.ts',
  webServer: external
    ? undefined
    : {
        command: 'node tools/stack.mjs serve',
        url: `${baseURL}/api/auth/providers`,
        reuseExistingServer: true,
        timeout: 300_000,
        stdout: 'pipe',
        stderr: 'pipe',
      },
  use: {
    baseURL,
    locale: 'en-US',
    // The seeded runs are dated in UTC; a fixed browser zone keeps "which day is it" the same on every machine.
    timezoneId: 'America/New_York',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
    launchOptions: executablePath ? { executablePath } : {},
  },
  projects: [
    {
      name: 'desktop',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } },
      grepInvert: /@mobile/,
    },
    {
      // A phone-sized Chromium: tests tagged @mobile only.
      name: 'mobile',
      use: { ...devices['Pixel 7'], viewport: { width: 375, height: 812 } },
      grep: /@mobile/,
    },
  ],
});
