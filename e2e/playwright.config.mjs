import { defineConfig } from '@playwright/test';
import { assertSafeBaseUrl } from './fixtures/safety.mjs';
const baseURL = assertSafeBaseUrl('http://127.0.0.1:4331');
const executablePath = process.env.E2E_CHROMIUM_PATH;
export default defineConfig({
  testDir: './runna', timeout: 60000, expect: { timeout: 12000 }, workers: 1,
  fullyParallel: false, retries: 0,
  reporter: [['list'], ['json', { outputFile: '../output/run-plan-qa/results.json' }], ['html', { outputFolder: '../output/run-plan-qa/report', open: 'never' }]],
  outputDir: '../output/run-plan-qa/artifacts',
  use: { baseURL, launchOptions: { ...(executablePath ? { executablePath } : {}) }, viewport: { width: 1440, height: 1000 }, locale: 'en-US', timezoneId: 'America/New_York', trace: 'retain-on-failure', screenshot: 'only-on-failure' },
  webServer: { command: 'node runna/fixtures.mjs', url: 'http://127.0.0.1:4330/ready', timeout: 180000, reuseExistingServer: false, stdout: 'pipe', stderr: 'pipe' },
});
