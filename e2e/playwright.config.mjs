import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './runna', timeout: 60000, expect: { timeout: 12000 }, workers: 1,
  fullyParallel: false, retries: 0,
  reporter: [['list'], ['json', { outputFile: '../output/run-plan-qa/results.json' }], ['html', { outputFolder: '../output/run-plan-qa/report', open: 'never' }]],
  outputDir: '../output/run-plan-qa/artifacts',
  use: { baseURL: 'http://127.0.0.1:4331', viewport: { width: 1440, height: 1000 }, locale: 'en-US', timezoneId: 'America/New_York', trace: 'retain-on-failure', screenshot: 'only-on-failure' },
  webServer: { command: 'node runna/fixtures.mjs', url: 'http://127.0.0.1:4330/ready', timeout: 180000, reuseExistingServer: false, stdout: 'pipe', stderr: 'pipe' },
});
