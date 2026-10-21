// A5 Rest days to zero form, the sentence under the chart on Analysis > Load balance that came out of the Runalyze review: how many days
// of no running it would take for form to reach zero, read off the dotted stretch (docs/README-ANALYSIS.md, "Fitness, Fatigue and Form",
// "The days after today").
//
// The number of days is checked against the API's dotted stretch and against the closed form, 8.4 x ln(fatigue / fitness), worked out
// again here. Case numbers are the rows of replica/runalyze/test-plan.md.
import type { Locator, Page } from '@playwright/test';
import { Api, newRunner } from '../fixtures/api.ts';
import { importRunSpecs, sharedRunner, type RunSpec } from '../fixtures/analysis.ts';
import { shortDay, signedChange } from '../fixtures/format.ts';
import { pageOpener } from '../fixtures/pages.ts';
import { a11yViolations, contrastProblems, expect, expectNoRawKeys, test } from '../fixtures/test.ts';

const ROUTE = '/analysis/load-balance';
const pages = pageOpener();
test.afterEach(() => pages.closeAll());

interface Series {
  status: string;
  today: string;
  points: Array<{ date: string; fitness: number; fatigue: number; form: number }>;
  projection: Array<{ date: string; fitness: number; fatigue: number; form: number }>;
  current: { date: string; fitness: number; fatigue: number; form: number };
  fitnessDays: number;
  fatigueDays: number;
}

const seriesOf = async (api: Api): Promise<Series> => (await api.get('/api/training/series')).json;
const fitnessCard = (page: Page): Locator => page.getByRole('region', { name: 'Fitness, fatigue and form', exact: true });
const rest = (page: Page): Locator => fitnessCard(page).getByText(/^If you did not run, your form would reach zero/);
const stillBelow = (page: Page): Locator => fitnessCard(page).getByText(/^Your form is below zero today, and it would still be below zero/);

/** How the card reads a form number: to one decimal, so -0.04 is 0.0 and counts as zero. */
const readsZeroOrAbove = (form: number): boolean => Number(form.toFixed(1)) >= 0;

/** Four weeks of easy running, then a hard 12 km every day for five days (today's at midnight UTC, so it has happened): tired. */
const tiredRuns = (): RunSpec[] => {
  const runs: RunSpec[] = [];
  for (let week = 0; week < 4; week += 1) {
    for (const offset of [8, 10, 12]) runs.push({ name: `E2E rest easy ${week * 7 + offset}`, daysBack: week * 7 + offset, km: 5, pace: 360, hr: 140 });
  }
  for (let back = 0; back < 5; back += 1) runs.push({ name: `E2E rest hard ${back}`, daysBack: back, km: 12, pace: 290, hr: 172, hourUtc: back === 0 ? 0 : 11 });
  return runs;
};

/** Three weeks of easy running that stopped a week ago: fatigue has gone and fitness has not, so form is above zero. */
const freshRuns = (): RunSpec[] => {
  const runs: RunSpec[] = [];
  for (let week = 0; week < 3; week += 1) {
    for (const offset of [9, 11, 13]) runs.push({ name: `E2E rest fresh ${week * 7 + offset}`, daysBack: week * 7 + offset, km: 6, pace: 350, hr: 140 });
  }
  return runs;
};

let tired: Awaited<ReturnType<typeof sharedRunner<null>>>;

test.beforeAll(async () => {
  test.setTimeout(480_000);
  tired = await sharedRunner('rest-tired', async ({ api }) => {
    await importRunSpecs(api, tiredRuns());
    return null;
  });
});

test.describe('A5 rest days to zero form: what the card says', () => {
  test('A5-H1 a tired runner is told the day form would reach zero, and it is the first day of the dotted stretch that reads zero or above', async ({ browser, baseURL, guard }) => {
    const series = await seriesOf(tired.api);
    expect(series.status).toBe('ready');
    expect(series.current.form).toBeLessThan(-3);
    const first = series.projection.findIndex((day) => readsZeroOrAbove(day.form));
    expect(first, 'the stretch reaches zero within its 14 days').toBeGreaterThan(0);
    const days = first + 1;
    const date = series.projection[first].date;
    // Not the day before: the day before still reads below zero.
    expect(readsZeroOrAbove(series.projection[first - 1].form)).toBe(false);

    const page = await pages.open(browser, baseURL, guard, tired, ROUTE);
    await expect(fitnessCard(page)).toBeVisible();
    await expect(rest(page)).toHaveText(`If you did not run, your form would reach zero in ${days} days, around ${shortDay(date)}.`);
    await expect(stillBelow(page)).toHaveCount(0);
  });

  test('A5-H2 the number of days is the closed form of the model: 8.4 x ln(fatigue / fitness), rounded up to a whole day', async ({ browser, baseURL, guard }) => {
    const series = await seriesOf(tired.api);
    const { fitness, fatigue } = series.current;
    expect(series.fitnessDays).toBe(42);
    expect(series.fatigueDays).toBe(7);
    // The two averages are equal at k = ln(fatigue / fitness) / (1/7 - 1/42) days; the API's numbers are rounded to a tenth, hence the 1.
    const closedForm = Math.log(fatigue / fitness) / (1 / series.fatigueDays - 1 / series.fitnessDays);
    const days = series.projection.findIndex((day) => readsZeroOrAbove(day.form)) + 1;
    expect(Math.abs(days - Math.ceil(closedForm))).toBeLessThanOrEqual(1);
    expect(closedForm).toBeGreaterThan(days - 1.5);
    expect(closedForm).toBeLessThan(days + 0.5);

    const page = await pages.open(browser, baseURL, guard, tired, ROUTE);
    await expect(rest(page)).toContainText(`in ${days} days`);
  });

  test('A5-H3 the sentence sits with the dotted-stretch note, under the chart, and is the same whatever range the chart shows', async ({ browser, baseURL, guard }) => {
    const page = await pages.open(browser, baseURL, guard, tired, ROUTE);
    await expect(rest(page)).toBeVisible();
    const sentence = await rest(page).innerText();
    await expect(fitnessCard(page).getByText('Dotted: where they would go if you did not run for the next 14 days.')).toBeVisible();
    // The note about the dotted stretch comes first, then the sentence that reads it.
    const notes = await fitnessCard(page).locator('p.analysis-fit-v2-note').allInnerTexts();
    expect(notes.findIndex((text) => text.startsWith('Dotted:'))).toBe(notes.findIndex((text) => text === sentence) - 1);

    const ranges = fitnessCard(page).getByRole('group', { name: 'Time range' });
    for (const label of ['6 wk', '3 mo', '1 yr', '6 mo']) {
      await ranges.getByRole('button', { name: label, exact: true }).click();
      await expect(ranges.getByRole('button', { name: label, exact: true })).toHaveAttribute('aria-pressed', 'true');
      await expect(rest(page)).toHaveText(sentence);
    }
  });

  test('A5-H4 the form on the card and the sentence tell the same story: below zero, tired, and a way back', async ({ browser, baseURL, guard }) => {
    const page = await pages.open(browser, baseURL, guard, tired, ROUTE);
    const series = await seriesOf(tired.api);
    const cards = fitnessCard(page).getByRole('region', { name: 'Fitness, fatigue and form today' });
    await expect(cards.locator('article').nth(2).locator('strong')).toHaveText(signedChange(series.current.form));
    await expect(cards.locator('article').nth(2)).toContainText('Tired');
    await expect(rest(page)).toBeVisible();
  });
});

test.describe('A5 rest days to zero form: runners the sentence has nothing to say to', () => {
  test('A5-E1 a runner whose form is above zero is told nothing about rest', async ({ browser, baseURL, guard }) => {
    const made = await newRunner('rest-fresh');
    await importRunSpecs(made.api, freshRuns());
    const series = await seriesOf(made.api);
    expect(series.current.form, 'three easy weeks that stopped a week ago leave form above zero').toBeGreaterThan(0);
    expect(series.projection.every((day) => day.form > 0)).toBe(true);

    const page = await pages.open(browser, baseURL, guard, { token: made.api.token as string, email: made.email }, ROUTE);
    await expect(fitnessCard(page)).toBeVisible();
    await expect(fitnessCard(page).getByRole('region', { name: 'Fitness, fatigue and form today' })).toBeVisible();
    await expect(rest(page)).toHaveCount(0);
    await expect(stillBelow(page)).toHaveCount(0);
    await expect(fitnessCard(page).getByText('Dotted: where they would go if you did not run for the next 14 days.')).toBeVisible();
  });

  test('A5-E2 when fatigue is more than about five times fitness the sentence says form would still be below zero after the 14 days shown', async ({ browser, baseURL, guard }) => {
    const made = await newRunner('rest-later');
    // One tiny run twenty days ago, so there is a history, and one huge run today: fatigue 5.6 times fitness.
    await importRunSpecs(made.api, [
      { name: 'E2E rest tiny old', daysBack: 20, km: 1, pace: 400, hr: 120 },
      { name: 'E2E rest huge today', daysBack: 0, km: 30, pace: 300, hr: 182, hourUtc: 0 },
    ]);
    const series = await seriesOf(made.api);
    expect(series.status).toBe('ready');
    expect(series.current.fatigue / series.current.fitness, 'above e^(14 / 8.4) = 5.3').toBeGreaterThan(5.3);
    expect(series.projection.every((day) => !readsZeroOrAbove(day.form))).toBe(true);

    const page = await pages.open(browser, baseURL, guard, { token: made.api.token as string, email: made.email }, ROUTE);
    await expect(stillBelow(page)).toHaveText('Your form is below zero today, and it would still be below zero after the 14 days shown if you did not run.');
    await expect(rest(page)).toHaveCount(0);
  });

  test('A5-E3 a runner with no runs, or with too short a history, sees the card\'s own sentence and no rest', async ({ browser, baseURL, guard }) => {
    const none = await newRunner('rest-none');
    const page = await pages.open(browser, baseURL, guard, { token: none.api.token as string, email: none.email }, ROUTE);
    await expect(fitnessCard(page)).toContainText('No run has an Effort score yet.');
    await expect(rest(page)).toHaveCount(0);

    const young = await newRunner('rest-young');
    await importRunSpecs(young.api, [
      { name: 'E2E rest young one', daysBack: 1, km: 10, pace: 300, hr: 175 },
      { name: 'E2E rest young two', daysBack: 3, km: 10, pace: 300, hr: 175 },
    ]);
    expect((await seriesOf(young.api)).status).toBe('building');
    const second = await pages.open(browser, baseURL, guard, { token: young.api.token as string, email: young.email }, ROUTE);
    await expect(fitnessCard(second)).toContainText('Fitness and form need at least 14 days of history to mean anything.');
    await expect(rest(second)).toHaveCount(0);
    await expect(stillBelow(second)).toHaveCount(0);
  });

  test('A5-E4 the day is the runner\'s own: in Auckland, where it is already tomorrow, the days and the date still agree with the API', async ({ browser, baseURL, guard }) => {
    const made = await newRunner('rest-auckland');
    expect((await made.api.patch('/api/profile/me/time-zone', { timeZone: 'Pacific/Auckland' })).status).toBe(200);
    // 04:00 UTC is 17:00 in Auckland on the same date; today's run stays at midnight UTC so that it has happened.
    await importRunSpecs(made.api, tiredRuns().map((run) => ({ ...run, hourUtc: run.daysBack === 0 ? 0 : 4 })));
    const series = await seriesOf(made.api);
    expect(series.status).toBe('ready');
    const first = series.projection.findIndex((day) => readsZeroOrAbove(day.form));
    expect(first).toBeGreaterThanOrEqual(0);

    const page = await pages.open(browser, baseURL, guard, { token: made.api.token as string, email: made.email }, ROUTE);
    await expect(rest(page)).toHaveText(`If you did not run, your form would reach zero in ${first + 1} days, around ${shortDay(series.projection[first].date)}.`);
    // The first day of the stretch is the day after the runner's own today, whatever the clock says in UTC.
    const today = new Date(`${series.today}T12:00:00Z`);
    today.setUTCDate(today.getUTCDate() + 1);
    expect(series.projection[0].date).toBe(today.toISOString().slice(0, 10));
  });
});

test.describe('A5 rest days to zero form: in other conditions', () => {
  test('A5-L1 in Chinese the sentence is translated and no raw key shows', async ({ browser, baseURL, guard }) => {
    const page = await pages.open(browser, baseURL, guard, tired, null);
    await page.addInitScript(() => localStorage.setItem('hermes_lang', 'zh-CN'));
    await page.goto(ROUTE);
    const card = page.getByRole('region', { name: '体能、疲劳与状态', exact: true });
    await expect(card).toBeVisible({ timeout: 15_000 });
    await expect(card.getByText(/^如果不跑步，状态大约在 \d+ 天后回到零（\d+月\d+日）。$/)).toBeVisible();
    await expect(card).not.toContainText('If you did not run');
    await expectNoRawKeys(page);
  });

  for (const theme of ['light', 'midnight']) {
    test(`A5-A1 the card with the sentence is readable in the ${theme} theme and has no accessibility violations`, async ({ browser, baseURL, guard }) => {
      const page = await pages.open(browser, baseURL, guard, tired, null);
      await page.addInitScript((value) => localStorage.setItem('hermes_theme', value), theme);
      await page.goto(ROUTE);
      await expect(rest(page)).toBeVisible();
      expect(await contrastProblems(page, { include: ['#load-fitness'] }), `${theme}, contrast`).toEqual([]);
      expect(await a11yViolations(page, { onlyRules: ['color-contrast'], include: ['#load-fitness'] }), `${theme}, axe`).toEqual([]);
    });
  }

  test('A5-M1 @mobile the sentence fits a phone', async ({ browser, baseURL, guard }) => {
    const page = await pages.open(browser, baseURL, guard, tired, ROUTE);
    await page.setViewportSize({ width: 375, height: 812 });
    await expect(rest(page)).toBeVisible();
    const box = await rest(page).boundingBox();
    expect(box).not.toBeNull();
    expect((box as { x: number; width: number }).x + (box as { x: number; width: number }).width, 'the sentence ends inside the screen').toBeLessThanOrEqual(375);
  });
});
