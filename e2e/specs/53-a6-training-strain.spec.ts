// A6 Training strain, the card that came out of the Runalyze review: the load of the last 7 days times its monotony (Foster 1998), the fifth card of
// the row on Analysis > Load balance, next to the Monotony card it is made with.
//
// The loads are worked out again here, in this file, from the runs the API lists and the rule the methods document gives (docs/README-ANALYSIS.md,
// "Training Load and the Load Ratio", "Monotony and training strain" and "Effort Score"): the Effort Score of each run from its heart rate, a day's
// load as the sum of its runs, then the mean, the spread over seven days, the monotony, the strain and the change on the week before. A card that
// printed a wrong week, divided by six, forgot the rest days or compared the wrong weeks fails.
import type { Locator, Page } from '@playwright/test';
import { Api, newRunner } from '../fixtures/api.ts';
import { importRunSpecs, sharedRunner, type RunSpec } from '../fixtures/analysis.ts';
import { browserToday, dailyLoads, signed, weekOf, whole } from '../fixtures/strain.ts';
import { pageOpener } from '../fixtures/pages.ts';
import { a11yViolations, contrastProblems, expect, expectNoHorizontalOverflow, expectNoRawKeys, test } from '../fixtures/test.ts';

const ROUTE = '/analysis/load-balance';
const pages = pageOpener();
test.afterEach(() => pages.closeAll());

interface Row {
  id: number;
  distanceKm: number;
  movingTimeSeconds: number;
  startTime: string;
  averageHeartRate: number | null;
  maxHeartRate: number | null;
}

const rowsOf = async (api: Api): Promise<Row[]> => (await api.get('/api/activities/analysis')).json;

const row = (page: Page): Locator => page.locator('.analysis-load-v2-metrics.is-load-row');
const card = (page: Page, label: string): Locator => row(page).locator(':scope > article').filter({ has: page.locator('span', { hasText: new RegExp(`^${label}$`) }) });

/** Three weeks of running, with rest days and hard days, all with a heart rate (so the loads can be worked out from it). */
const FIXTURE: RunSpec[] = [
  // The last seven days (1 to 7 days back): five runs, two rests (3 and 6).
  { name: 'E2E a6 w0 d1', daysBack: 1, km: 8, pace: 300, hr: 150 },
  { name: 'E2E a6 w0 d2', daysBack: 2, km: 6, pace: 330, hr: 140 },
  { name: 'E2E a6 w0 d4', daysBack: 4, km: 12, pace: 315, hr: 165 },
  { name: 'E2E a6 w0 d5', daysBack: 5, km: 5, pace: 340, hr: 135 },
  { name: 'E2E a6 w0 d7', daysBack: 7, km: 10, pace: 300, hr: 158 },
  // The seven days before (8 to 14 days back): six runs, one rest (12).
  { name: 'E2E a6 w1 d8', daysBack: 8, km: 7, pace: 320, hr: 145 },
  { name: 'E2E a6 w1 d9', daysBack: 9, km: 7, pace: 320, hr: 146 },
  { name: 'E2E a6 w1 d10', daysBack: 10, km: 9, pace: 305, hr: 155 },
  { name: 'E2E a6 w1 d11', daysBack: 11, km: 6, pace: 335, hr: 138 },
  { name: 'E2E a6 w1 d13', daysBack: 13, km: 14, pace: 325, hr: 150 },
  { name: 'E2E a6 w1 d14', daysBack: 14, km: 5, pace: 340, hr: 136 },
  // Older, and the hardest effort of the three weeks, which sets the highest heart rate the loads are scaled by.
  { name: 'E2E a6 w2 d17', daysBack: 17, km: 6, pace: 260, hr: 178 },
  { name: 'E2E a6 w2 d19', daysBack: 19, km: 8, pace: 310, hr: 148 },
];

let runner: Awaited<ReturnType<typeof sharedRunner<null>>>;

test.beforeAll(async () => {
  test.setTimeout(480_000);
  runner = await sharedRunner('a6', async ({ api }) => {
    await importRunSpecs(api, FIXTURE, { wait: false });
    return null;
  });
});

async function openPage(page: Page): Promise<void> {
  await expect(page.getByRole('heading', { level: 2, name: 'Acute vs. chronic load' })).toBeVisible();
  await expect(row(page)).toBeVisible();
}

test.describe('A6 training strain: what the card says', () => {
  test('A6-H1 the Strain card is the load of the last seven days times their monotony, with the working under it', async ({ browser, baseURL, guard }) => {
    const page = await pages.open(browser, baseURL, guard, runner, ROUTE);
    await openPage(page);
    const loads = dailyLoads(await rowsOf(runner.api), browserToday());
    const week = weekOf(loads.slice(-7));
    expect(week.strain, 'the fixture week has load').not.toBeNull();

    await expect(row(page).locator(':scope > article')).toHaveCount(5);
    const strain = card(page, 'Strain');
    await expect(strain.locator(':scope > strong')).toHaveText(whole(week.strain as number));
    await expect(strain.locator(':scope > small')).toContainText(`Week load ${whole(week.load)} × monotony ${(week.monotony as number).toFixed(2)}. A hard week with little variety scores highest.`);
    // What is printed multiplies out, to the rounding of its parts.
    expect(Math.abs(Math.round(week.load) * Number((week.monotony as number).toFixed(2)) - (week.strain as number))).toBeLessThan(0.005 * (week.strain as number) + 1);
  });

  test('A6-H2 the Monotony card beside it is the same week: the mean day over the spread of the seven days', async ({ browser, baseURL, guard }) => {
    const page = await pages.open(browser, baseURL, guard, runner, ROUTE);
    await openPage(page);
    const week = weekOf(dailyLoads(await rowsOf(runner.api), browserToday()).slice(-7));

    await expect(card(page, 'Monotony').locator(':scope > strong')).toHaveText((week.monotony as number).toFixed(1));
    // Divided by six it would be a different number: the card takes the week as seven days, rest days as zero.
    const sixDays = week.mean / Math.sqrt(week.spread ** 2 * (7 / 6));
    expect(sixDays.toFixed(1)).not.toBe((week.monotony as number).toFixed(1));
  });

  test('A6-H3 the change is on the week before: the same sum over the seven days before, as a whole percent', async ({ browser, baseURL, guard }) => {
    const page = await pages.open(browser, baseURL, guard, runner, ROUTE);
    await openPage(page);
    const loads = dailyLoads(await rowsOf(runner.api), browserToday());
    const week = weekOf(loads.slice(-7));
    const before = weekOf(loads.slice(-14, -7));
    const change = Math.round(((week.strain as number) / (before.strain as number) - 1) * 100);

    await expect(card(page, 'Strain').locator(':scope > em')).toHaveText(`${signed(change)} vs. last week`);
    // The two weeks are not the same week: the card is not comparing a week with itself.
    expect(before.strain).not.toBeNull();
    expect(Math.round(before.strain as number)).not.toBe(Math.round(week.strain as number));
  });

  test('A6-H4 both cards link to the rule, and the rule is a heading of the methods document', async ({ browser, baseURL, guard }) => {
    const page = await pages.open(browser, baseURL, guard, runner, ROUTE);
    await openPage(page);

    for (const label of ['Strain', 'Monotony']) {
      await expect(card(page, label).getByRole('link', { name: 'How it is worked out' })).toHaveAttribute('href', /README-ANALYSIS\.md#monotony-and-training-strain$/);
    }
    // The Strain card has no line of its own and is not drawn as a warning: only the Monotony card can turn amber.
    await expect(card(page, 'Strain')).toHaveClass(/is-neutral/);
    await expect(card(page, 'Strain')).not.toHaveClass(/is-warn/);
  });
});

test.describe('A6 training strain: runners it has little to say to', () => {
  test('A6-E1 a week with no run in it has no monotony and no strain, and the card says there was no load', async ({ browser, baseURL, guard }) => {
    const made = await newRunner('a6-rest');
    await importRunSpecs(made.api, [9, 11, 13, 15, 17].map((daysBack): RunSpec => ({ name: `E2E a6 rest d${daysBack}`, daysBack, km: 6, pace: 320, hr: 145 })), { wait: false });
    const page = await pages.open(browser, baseURL, guard, { token: made.api.token as string, email: made.email }, ROUTE);
    await openPage(page);
    const week = weekOf(dailyLoads(await rowsOf(made.api), browserToday()).slice(-7));
    expect(week.strain).toBeNull();

    await expect(card(page, 'Strain').locator(':scope > strong')).toHaveText('--');
    await expect(card(page, 'Strain').locator(':scope > em')).toHaveText('No recent load');
    await expect(card(page, 'Monotony').locator(':scope > strong')).toHaveText('--');
  });

  test('A6-E2 under two weeks of history there is a week but no week before it to compare with, and the card says so', async ({ browser, baseURL, guard }) => {
    const made = await newRunner('a6-young');
    await importRunSpecs(made.api, [1, 2, 3, 5, 7, 8, 9].map((daysBack): RunSpec => ({ name: `E2E a6 young d${daysBack}`, daysBack, km: 6 + (daysBack % 3), pace: 320, hr: 140 + daysBack })), { wait: false });
    const page = await pages.open(browser, baseURL, guard, { token: made.api.token as string, email: made.email }, ROUTE);
    await openPage(page);
    const loads = dailyLoads(await rowsOf(made.api), browserToday());
    expect(loads.length, 'under 14 days of history').toBeLessThan(14);
    const week = weekOf(loads.slice(-7));

    await expect(card(page, 'Strain').locator(':scope > strong')).toHaveText(whole(week.strain as number));
    await expect(card(page, 'Strain').locator(':scope > em')).toHaveText('No prior week to compare');
  });

  test('A6-E3 a runner with no run at all has a dash, and the page still says the baseline is forming', async ({ browser, baseURL, guard }) => {
    const made = await newRunner('a6-none');
    const page = await pages.open(browser, baseURL, guard, { token: made.api.token as string, email: made.email }, ROUTE);
    await openPage(page);

    await expect(card(page, 'Strain').locator(':scope > strong')).toHaveText('--');
    await expect(card(page, 'Strain').locator(':scope > em')).toHaveText('No recent load');
    await expect(row(page)).toContainText('Baseline forming');
  });

  test('A6-N1 another runner\'s weeks are never on the card: each runner\'s numbers are their own', async ({ browser, baseURL, guard }) => {
    const other = await newRunner('a6-other');
    // The lengths differ from day to day: eight equal runs on eight days in a row are a flat week, whose strain has no end, at the hours when the browser's date and the
    // runner's (UTC) date line up so that seven days of the week each have a run.
    await importRunSpecs(other.api, [1, 2, 3, 4, 5, 6, 7, 8].map((daysBack): RunSpec => ({ name: `E2E a6 other d${daysBack}`, daysBack, km: 3 + (daysBack % 3) * 1.5, pace: 400, hr: 120 })), { wait: false });
    const page = await pages.open(browser, baseURL, guard, { token: other.api.token as string, email: other.email }, ROUTE);
    await openPage(page);
    const mine = weekOf(dailyLoads(await rowsOf(runner.api), browserToday()).slice(-7));
    const theirs = weekOf(dailyLoads(await rowsOf(other.api), browserToday()).slice(-7));

    expect(Math.round(theirs.strain as number)).not.toBe(Math.round(mine.strain as number));
    await expect(card(page, 'Strain').locator(':scope > strong')).toHaveText(whole(theirs.strain as number));
  });
});

test.describe('A6 training strain: in other conditions', () => {
  /** How many cards are on each line of the row, top to bottom. */
  async function cardsPerLine(page: Page): Promise<number[]> {
    const tops = await row(page).locator(':scope > article').evaluateAll((nodes) => nodes.map((node) => Math.round(node.getBoundingClientRect().top)));
    const lines = new Map<number, number>();
    for (const top of tops) lines.set(top, (lines.get(top) ?? 0) + 1);
    return [...lines.keys()].sort((a, b) => a - b).map((top) => lines.get(top) as number);
  }

  for (const [width, lines] of [[1440, [5]], [1280, [3, 2]], [1000, [2, 2, 1]], [375, [1, 1, 1, 1, 1]]] as const) {
    test(`A6-M1 at ${width} px the five cards are ${lines.join(' and ')} to a line, and the page does not scroll sideways`, async ({ browser, baseURL, guard }) => {
      const page = await pages.open(browser, baseURL, guard, runner, null);
      await page.setViewportSize({ width, height: 900 });
      await page.goto(ROUTE);
      await openPage(page);
      await expect.poll(() => cardsPerLine(page)).toEqual(lines);
      await expectNoHorizontalOverflow(page);
    });
  }

  test('A6-L1 in Chinese the card is translated and no raw key shows', async ({ browser, baseURL, guard }) => {
    const page = await pages.open(browser, baseURL, guard, runner, null);
    await page.addInitScript(() => localStorage.setItem('hermes_lang', 'zh-CN'));
    await page.goto(ROUTE);
    await expect(row(page)).toBeVisible();
    const week = weekOf(dailyLoads(await rowsOf(runner.api), browserToday()).slice(-7));
    const strain = row(page).locator(':scope > article').nth(4);

    await expect(strain.locator(':scope > span')).toHaveText('训练紧张度');
    await expect(strain.locator(':scope > strong')).toHaveText(whole(week.strain as number));
    await expect(strain.locator(':scope > small')).toContainText(`周负荷 ${whole(week.load)} × 单调度 ${(week.monotony as number).toFixed(2)}`);
    await expectNoRawKeys(page);
  });

  for (const theme of ['light', 'midnight']) {
    test(`A6-A1 the row is readable in the ${theme} theme and has no accessibility violations`, async ({ browser, baseURL, guard }) => {
      const page = await pages.open(browser, baseURL, guard, runner, null);
      await page.addInitScript((value) => localStorage.setItem('hermes_theme', value), theme);
      await page.goto(ROUTE);
      await openPage(page);
      expect(await contrastProblems(page, { include: ['.analysis-load-v2-metrics.is-load-row'] }), `${theme}, contrast`).toEqual([]);
      expect(await a11yViolations(page, { include: ['.analysis-load-v2-metrics.is-load-row'] }), `${theme}, axe`).toEqual([]);
    });
  }
});
