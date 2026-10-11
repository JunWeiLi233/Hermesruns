// F02 Progress: compare a period with the one before it (M8). Recon path: Progress -> pick a range -> compare date range.
// In HermesRuns: the Progression card on Home has a Compare button beside the 1M / 3M / 6M / 12M switch. It sets the range beside the
// stretch of the same length just before it: a dashed line on the chart, and under each figure how it differs.
//
// A throwaway runner with three runs in the last three months (8, 10 and 12 km, 10, 30 and 55 days ago) and three in the three months
// before (6, 6 and 8 km, 100, 120 and 150 days ago), all at 5:30 /km, none with climb. The numbers the page should show follow from that.
import type { Page } from '@playwright/test';
import { newRunner } from '../fixtures/api.ts';
import { daysAgo, gpxRun } from '../fixtures/gpx.ts';
import { a11yViolations, contextWith, contrastProblems, expect, expectNoHorizontalOverflow, expectNoRawKeys, test } from '../fixtures/test.ts';

const CURRENT = [[10, 8], [30, 10], [55, 12]] as const;
const BEFORE = [[100, 6], [120, 6], [150, 8]] as const;

async function runnerWithTwoStretches(label: string) {
  const made = await newRunner(label);
  for (const [days, km] of [...CURRENT, ...BEFORE]) {
    await made.api.importRun(`compare-${days}.gpx`, gpxRun({ name: `E2E compare ${days}`, start: daysAgo(days), distanceM: km * 1000, pace: 330 }));
  }
  return made;
}

const card = (page: Page) => page.locator('.hd-progression');
const frame = (page: Page, name: string) => card(page).getByRole('button', { name, exact: true });
const compareButton = (page: Page) => card(page).getByRole('button', { name: 'Compare', exact: true });

async function openHome(page: Page): Promise<void> {
  await page.goto('/profile');
  await expect(card(page)).toBeVisible({ timeout: 20_000 });
  await expect(card(page).getByText('Total distance')).toBeVisible();
}

test.describe('F02 Progression: compare with the period before (M8)', () => {
  test('F02-H11 Compare sets the range beside the one before it: a dashed line, the stretch named, and the change under each figure', async ({ browser, baseURL, guard }) => {
    const made = await runnerWithTwoStretches('progress-compare');
    const context = await contextWith(browser, { token: made.api.token as string, email: made.email }, baseURL as string, guard);
    try {
      const page = await context.newPage();
      await openHome(page);
      await frame(page, '3M').click();
      await expect(compareButton(page)).toHaveAttribute('aria-pressed', 'false');
      await expect(card(page).locator('.hd-progression-hero-stat strong')).toHaveText('30.0 km');
      await expect(card(page).locator('.hd-progression-delta')).toHaveCount(0);
      await expect(card(page).locator('.hd-progression-line.is-previous')).toHaveCount(0);

      await compareButton(page).click();
      await expect(compareButton(page)).toHaveAttribute('aria-pressed', 'true');
      // 30 km against 20 km: 10 km more, half as much again. The sessions are three and three, the pace the same.
      const hero = card(page).locator('.hd-progression-hero-stat');
      await expect(hero.locator('.hd-progression-delta')).toHaveText('10.0 km more (+50%)');
      await expect(hero.locator('.hd-progression-compared')).toContainText('Compared with');
      const stats = card(page).locator('.hd-progression-stat');
      await expect(stats.filter({ hasText: 'Sessions' }).locator('.hd-progression-delta')).toHaveText('Same as before');
      await expect(stats.filter({ hasText: 'Average pace' }).locator('.hd-progression-delta')).toHaveText('Same as before');
      await expect(stats.filter({ hasText: 'Total time' }).locator('.hd-progression-delta')).toHaveText(/more$/);
      // Nobody in this history has climb, so there is no climb change to show.
      await expect(stats.filter({ hasText: 'Total elevation' }).locator('.hd-progression-delta')).toHaveCount(0);
      await expect(card(page).locator('.hd-progression-line.is-previous')).toHaveCount(1);
      await expect(card(page).locator('.hd-progression-legend.is-compare')).toContainText('Before:');
      // The change in the better direction is green and said in words (more, not just a colour).
      await expect(hero.locator('.hd-progression-delta')).toHaveClass(/is-better/);
    } finally {
      await context.close();
    }
  });

  test('F02-H12 the scrubber reads out the stretch before at the same day, with the keyboard too', async ({ browser, baseURL, guard }) => {
    const made = await runnerWithTwoStretches('progress-scrub');
    const context = await contextWith(browser, { token: made.api.token as string, email: made.email }, baseURL as string, guard);
    try {
      const page = await context.newPage();
      await openHome(page);
      await frame(page, '3M').click();
      await compareButton(page).click();
      const scrubber = card(page).getByRole('slider');
      await scrubber.focus();
      await page.keyboard.press('End');
      const text = (await scrubber.getAttribute('aria-valuetext')) ?? '';
      expect(text, 'at the last day: the three months so far, and what the three before had added up to').toMatch(/Cumulative distance: 30\.0 km/);
      expect(text).toMatch(/Before: 20\.0 km/);
      await expect(card(page).locator('.hd-progression-readout-previous')).toContainText('Before: 20.0 km');
    } finally {
      await context.close();
    }
  });

  test('F02-H13 the choice is kept; all time has nothing before it, so Compare is off there and says why', async ({ browser, baseURL, guard }) => {
    const made = await runnerWithTwoStretches('progress-keep');
    const context = await contextWith(browser, { token: made.api.token as string, email: made.email }, baseURL as string, guard);
    try {
      const page = await context.newPage();
      await openHome(page);
      await frame(page, '3M').click();
      await compareButton(page).click();
      await expect(compareButton(page)).toHaveAttribute('aria-pressed', 'true');

      await page.reload();
      await expect(card(page)).toBeVisible({ timeout: 20_000 });
      await frame(page, '3M').click();
      await expect(compareButton(page)).toHaveAttribute('aria-pressed', 'true');
      await expect(card(page).locator('.hd-progression-hero-stat .hd-progression-delta')).toHaveText('10.0 km more (+50%)');

      // All time: no comparison, the button is disabled and its hint says why.
      await frame(page, 'All').click();
      await expect(compareButton(page)).toBeDisabled();
      await expect(card(page).locator('.hd-progression-delta')).toHaveCount(0);
      await expect(card(page).locator('.hd-progression-line.is-previous')).toHaveCount(0);
      await expect(card(page).locator('#hd-progression-compare-hint')).toContainText('Choose 1, 3, 6 or 12 months to compare');
      // And back: the comparison returns by itself.
      await frame(page, '6M').click();
      await expect(compareButton(page)).toBeEnabled();
      await expect(compareButton(page)).toHaveAttribute('aria-pressed', 'true');
      await expect(card(page).locator('.hd-progression-legend.is-compare')).toBeVisible();

      await compareButton(page).click();
      await expect(compareButton(page)).toHaveAttribute('aria-pressed', 'false');
      await expect(card(page).locator('.hd-progression-delta')).toHaveCount(0);
    } finally {
      await context.close();
    }
  });

  test('F02-E31 a stretch before with no runs says so in the change and draws no second line', async ({ browser, baseURL, guard }) => {
    const made = await newRunner('progress-none');
    await made.api.importRun('only-now.gpx', gpxRun({ name: 'E2E compare only now', start: daysAgo(20), distanceM: 9000, pace: 330 }));
    const context = await contextWith(browser, { token: made.api.token as string, email: made.email }, baseURL as string, guard);
    try {
      const page = await context.newPage();
      await openHome(page);
      await frame(page, '3M').click();
      await compareButton(page).click();
      await expect(card(page).locator('.hd-progression-hero-stat .hd-progression-delta')).toHaveText('9.0 km more');
      await expect(card(page).locator('.hd-progression-line.is-previous')).toHaveCount(0);
      await expect(card(page).locator('.hd-progression-stat').filter({ hasText: 'Average pace' }).locator('.hd-progression-delta')).toHaveCount(0);
    } finally {
      await context.close();
    }
  });

  test('F02-E32 in Chinese the comparison is translated and no raw key shows', async ({ browser, baseURL, guard }) => {
    const made = await runnerWithTwoStretches('progress-zh');
    const context = await contextWith(browser, { token: made.api.token as string, email: made.email }, baseURL as string, guard);
    try {
      const page = await context.newPage();
      await page.addInitScript(() => localStorage.setItem('hermes_lang', 'zh-CN'));
      await page.goto('/profile');
      await expect(card(page)).toBeVisible({ timeout: 20_000 });
      await frame(page, '3个月').click();
      await card(page).getByRole('button', { name: '对比', exact: true }).click();
      await expect(card(page).locator('.hd-progression-hero-stat .hd-progression-delta')).toContainText('多 10.0 公里');
      await expect(card(page).locator('.hd-progression-legend.is-compare')).toContainText('之前：');
      await expectNoRawKeys(page);
    } finally {
      await context.close();
    }
  });

  test('F02-E33 the card is readable with the comparison on, in both themes, and has no accessibility violations', async ({ browser, baseURL, guard }) => {
    const made = await runnerWithTwoStretches('progress-a11y');
    for (const theme of ['light', 'midnight']) {
      const context = await contextWith(browser, { token: made.api.token as string, email: made.email }, baseURL as string, guard);
      try {
        const page = await context.newPage();
        await page.addInitScript((value) => localStorage.setItem('hermes_theme', value), theme);
        await openHome(page);
        await frame(page, '3M').click();
        await compareButton(page).click();
        await expect(card(page).locator('.hd-progression-line.is-previous')).toHaveCount(1);
        expect(await contrastProblems(page, { include: ['.hd-progression'] }), `${theme}, contrast`).toEqual([]);
        expect(await a11yViolations(page, { include: ['.hd-progression'] }), `${theme}, axe`).toEqual([]);
      } finally {
        await context.close();
      }
    }
  });

  test('F02-E34 @mobile the card with the comparison fits a phone', async ({ browser, baseURL, guard }) => {
    const made = await runnerWithTwoStretches('progress-mobile');
    const context = await contextWith(browser, { token: made.api.token as string, email: made.email }, baseURL as string, guard);
    try {
      const page = await context.newPage();
      await openHome(page);
      await frame(page, '3M').click();
      await compareButton(page).click();
      await expect(card(page).locator('.hd-progression-delta').first()).toBeVisible();
      await expectNoHorizontalOverflow(page);
    } finally {
      await context.close();
    }
  });
});
