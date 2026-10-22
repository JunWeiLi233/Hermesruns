import { newRunner } from '../fixtures/api.ts';
import { daysAgo, gpxRun } from '../fixtures/gpx.ts';
import { test, expect, contextWith } from '../fixtures/test.ts';

for (const mobile of [false, true]) {
test(`${mobile ? '@mobile ' : ''}soreness confirmations and recovery journal save through authenticated APIs`, async ({ browser, baseURL, guard }) => {
  const made = await newRunner('analysis-checkins');
  const context = await contextWith(browser, { email: made.email, token: made.api.token! }, baseURL as string, guard, mobile
    ? { viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true }
    : { viewport: { width: 1440, height: 900 } });
  try {
    const page = await context.newPage();
    await page.goto('/analysis');
    await page.getByRole('button', { name: 'Import data', exact: true }).click();
    await page.locator('input[type="file"]').setInputFiles({
      name: 'analysis-checkin-test.gpx', mimeType: 'application/gpx+xml',
      buffer: Buffer.from(gpxRun({ name: 'Check-in test run', start: daysAgo(1), distanceM: 5000, pace: 360, hr: 150 })),
    });
    await expect(page.getByRole('dialog').getByText('analysis-checkin-test.gpx', { exact: true })).toBeVisible();
    const imported = page.waitForResponse(r => r.url().includes('/api/import/batch') && r.request().method() === 'POST');
    await page.getByRole('dialog').getByRole('button', { name: /^Import 1 file/ }).click();
    expect((await imported).status()).toBe(200);
    await page.reload();
    for (const [index, level] of ['LOW', 'MEDIUM', 'HIGH'].entries()) {
      const button = page.locator('.analysis-v2-soreness-btn').nth(index);
      await expect(button).toBeEnabled();
      await button.click();
      const saved = page.waitForResponse(r => r.url().endsWith('/api/injury-risk/log') && r.request().method() === 'POST');
      await page.getByRole('dialog').getByRole('button', { name: 'Save check-in', exact: true }).click();
      expect((await saved).status()).toBe(200);
      await expect(button).toHaveAttribute('aria-pressed', 'true');
      expect((await made.api.get('/api/injury-risk/status')).json.recentLogs[0].level).toBe(level);
    }
    await page.goto('/analysis/injury-risk');
    await page.getByRole('button', { name: 'Recovery journal', exact: true }).click();
    const journal = page.getByRole('dialog');
    await journal.getByLabel('Sleep hours', { exact: true }).fill('8');
    await journal.getByLabel('Resting heart rate', { exact: true }).fill('55');
    await journal.getByLabel('Feeling', { exact: true }).fill('4');
    await journal.getByRole('button', { name: 'Save journal entry', exact: true }).click();
    await expect(journal.getByRole('status').filter({ hasText: 'Wellness saved.' })).toBeVisible();
    await expect(journal.getByRole('table')).toContainText('55');
    await expect(journal.getByLabel('Sleep hours', { exact: true })).toHaveValue('8');
    await expect(journal.getByLabel('Resting heart rate', { exact: true })).toHaveValue('55');
    await journal.getByLabel('Resting heart rate', { exact: true }).fill('54');
    await journal.getByRole('button', { name: 'Save journal entry', exact: true }).click();
    await expect(journal.getByRole('table')).toContainText('54');
    await expect(journal.getByRole('status').filter({ hasText: 'Wellness saved.' })).toBeVisible();
    expect(guard.problems).toEqual([]);
  } finally { await context.close(); }
});
}
