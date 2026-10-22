// F05 See how a race might go. Recon path: Predictions (5K, 10K, half, full) with a history.
// In HermesRuns: Analysis > Race predictions, and /prediction/5k | 10k | half | marathon. The model is the published Daniels and
// Gilbert VDOT one, so a runner with a single known race has a known answer; the tests use runner P, who has exactly one 5 km run.
import type { Page } from '@playwright/test';
import { Api, newRunner } from '../fixtures/api.ts';
import { daysAgo, gpxRun } from '../fixtures/gpx.ts';
import { danielsPredictSeconds, danielsVdot, toSeconds } from '../fixtures/format.ts';
import { a11yViolations, contextFor, contextWith, expect, expectNoHorizontalOverflow, expectNoRawKeys, test } from '../fixtures/test.ts';

test.describe.configure({ mode: 'serial' });

const DISTANCES = [
  { key: '5k', label: '5K', metres: 5000 },
  { key: '10k', label: '10K', metres: 10000 },
  { key: 'half', label: 'Half Marathon', metres: 21097.5 },
  { key: 'marathon', label: 'Marathon', metres: 42195 },
] as const;

let p: { api: Api; email: string; token: string };
let race: { id: number; km: number; seconds: number };

test.beforeAll(async () => {
  const made = await newRunner('pred');
  p = { api: made.api, email: made.email, token: made.api.token as string };
  const id = await p.api.importRun('p5k.gpx', gpxRun({ name: 'E2E P 5k race', start: daysAgo(20), distanceM: 5000, pace: 300 }));
  const run = ((await p.api.get('/api/activities')).json as Array<{ id: number; distanceKm: number; movingTimeSeconds: number }>).find((row) => row.id === id)!;
  race = { id, km: run.distanceKm, seconds: run.movingTimeSeconds };
});

const mainText = async (page: Page): Promise<string> => (await page.locator('main').innerText()).replace(/\s+/g, ' ');

/** "5K 5:00 /km 25:01" -> time in seconds, from the Analysis page's prediction list. */
async function hubPredictions(page: Page): Promise<Record<string, { seconds: number; pace: number }>> {
  await page.goto('/analysis');
  const list = page.getByRole('region', { name: 'Race predictions' });
  await expect(list).toBeVisible();
  const out: Record<string, { seconds: number; pace: number }> = {};
  for (const distance of DISTANCES) {
    const item = list.getByRole('listitem').filter({ has: page.getByText(distance.label, { exact: true }) });
    const text = (await item.innerText()).replace(/\s+/g, ' ');
    const match = text.match(/(\d+:\d\d) \/km (\d+:\d\d(?::\d\d)?)/);
    expect(match, `prediction for ${distance.label} reads like "5:00 /km 25:01": "${text}"`).toBeTruthy();
    out[distance.key] = { pace: toSeconds(match![1]), seconds: toSeconds(match![2]) };
  }
  return out;
}

test.describe('F05 happy path', () => {
  test('F05-H1 a runner with one 25-minute 5K gets the VDOT-equivalent time for every distance', async ({ browser, baseURL, guard }) => {
    const context = await contextWith(browser, p, baseURL as string, guard);
    try {
      const page = await context.newPage();
      const shown = await hubPredictions(page);
      const vdot = danielsVdot(race.km * 1000, race.seconds);
      for (const distance of DISTANCES) {
        const expected = danielsPredictSeconds(vdot, distance.metres);
        const actual = shown[distance.key].seconds;
        expect(Math.abs(actual - expected) / expected, `${distance.label}: ${actual}s shown, ${Math.round(expected)}s by the published formula`).toBeLessThan(0.012);
      }
    } finally {
      await context.close();
    }
  });

  test('F05-H2 longer races are predicted slower per kilometre and longer in total', async ({ browser, baseURL, guard }) => {
    const context = await contextWith(browser, p, baseURL as string, guard);
    try {
      const shown = await hubPredictions(await context.newPage());
      const order = DISTANCES.map((distance) => shown[distance.key]);
      for (let index = 1; index < order.length; index += 1) {
        expect(order[index].pace, `${DISTANCES[index].label} pace against ${DISTANCES[index - 1].label}`).toBeGreaterThanOrEqual(order[index - 1].pace);
        expect(order[index].seconds).toBeGreaterThan(order[index - 1].seconds);
      }
    } finally {
      await context.close();
    }
  });

  test('F05-H3 each distance page repeats the Analysis page prediction and shows the evidence behind it', async ({ browser, baseURL, guard }) => {
    const context = await contextWith(browser, p, baseURL as string, guard);
    try {
      const page = await context.newPage();
      const shown = await hubPredictions(page);
      const vdot = danielsVdot(race.km * 1000, race.seconds);
      for (const distance of DISTANCES) {
        await page.goto(`/prediction/${distance.key}`);
        await expect(page.getByRole('heading', { level: 1, name: 'Race Time Prediction' })).toBeVisible();
        const headline = page.locator('main strong').filter({ hasText: /^\d+:\d\d(?::\d\d)?$/ }).first();
        await expect(headline).toBeVisible();
        expect(toSeconds(await headline.innerText()), `${distance.label} headline against the Analysis page`).toBe(shown[distance.key].seconds);
        const evidence = page.getByRole('region', { name: 'Supporting Evidence' });
        const vdotShown = Number((await evidence.getByRole('article').filter({ hasText: 'Current VDOT' }).locator('strong').innerText()).trim());
        expect(Math.abs(vdotShown - vdot)).toBeLessThanOrEqual(0.1);
        await expect(evidence.getByRole('article').filter({ hasText: 'Samples' }).locator('strong')).toHaveText('1');
        await expect(evidence.getByRole('article').filter({ hasText: 'Best Match' })).toContainText('5.0 km');
      }
    } finally {
      await context.close();
    }
  });

  test('F05-H4 the distance buttons move between the four prediction pages', async ({ browser, baseURL, guard }) => {
    const context = await contextWith(browser, p, baseURL as string, guard);
    try {
      const page = await context.newPage();
      await page.goto('/prediction/5k');
      const nav = page.getByRole('navigation', { name: 'Analysis sections' });
      for (const distance of [DISTANCES[1], DISTANCES[2], DISTANCES[3], DISTANCES[0]]) {
        await nav.getByRole('button', { name: distance.label, exact: true }).click();
        await expect(page).toHaveURL(new RegExp(`/prediction/${distance.key}$`));
        await expect(page.getByRole('heading', { level: 1, name: 'Race Time Prediction' })).toBeVisible();
      }
    } finally {
      await context.close();
    }
  });
});

test.describe('F05 changing data', () => {
  test('F05-E1 a faster 5K lowers the predictions and deleting it brings them back', async ({ browser, baseURL, guard }) => {
    const context = await contextWith(browser, p, baseURL as string, guard);
    let fastId: number | null = null;
    try {
      const page = await context.newPage();
      const before = await hubPredictions(page);
      fastId = await p.api.importRun('p5k-fast.gpx', gpxRun({ name: 'E2E P 5k fast', start: daysAgo(6), distanceM: 5000, pace: 264 }));
      const faster = await hubPredictions(page);
      for (const distance of DISTANCES) expect(faster[distance.key].seconds, `${distance.label} after a faster 5K`).toBeLessThan(before[distance.key].seconds);
      // A 22:00 5K, 6 days old. The page leans on it by a weight that falls as the run ages (an hour is a fraction of a day), so how far the
      // prediction sits from 22:00 depends a little on the hour the suite runs at: 23 to 26 seconds over a day. The point of the case is that it
      // moves from the 23:20 of the older run towards 22:00, which a margin of 40 seconds still says.
      expect(Math.abs(faster['5k'].seconds - 1320)).toBeLessThanOrEqual(40);
      expect((await p.api.delete(`/api/activities/${fastId}`)).status).toBeLessThan(300);
      fastId = null;
      const back = await hubPredictions(page);
      expect(back['5k'].seconds).toBe(before['5k'].seconds);
    } finally {
      if (fastId) await p.api.delete(`/api/activities/${fastId}`);
      await context.close();
    }
  });

  test('F05-E2 a run older than the 90 days the page talks about does not move the predictions', async ({ browser, baseURL, guard }) => {
    const context = await contextWith(browser, p, baseURL as string, guard);
    let oldId: number | null = null;
    try {
      const page = await context.newPage();
      const before = await hubPredictions(page);
      oldId = await p.api.importRun('p5k-old.gpx', gpxRun({ name: 'E2E P 5k long ago', start: daysAgo(130), distanceM: 5000, pace: 240 }));
      const after = await hubPredictions(page);
      expect(after['5k'].seconds).toBe(before['5k'].seconds);
    } finally {
      if (oldId) await p.api.delete(`/api/activities/${oldId}`);
      await context.close();
    }
  });
});

test.describe('F05 empty and odd states', () => {
  test('F05-E3 a runner with no runs gets "not enough data", not NaN, Infinity or a blank page', async ({ browser, baseURL, guard }) => {
    const context = await contextFor(browser, 'b', baseURL as string, guard);
    try {
      const page = await context.newPage();
      for (const distance of DISTANCES) {
        await page.goto(`/prediction/${distance.key}`);
        await expect(page.getByText('Not enough data yet').first()).toBeVisible();
        const text = await mainText(page);
        expect(text).not.toMatch(/NaN|Infinity|undefined|\bnull\b/);
      }
      await page.goto('/analysis');
      await expect(page.getByRole('heading', { level: 2, name: 'Import a few runs before this page can act like a coach' })).toBeVisible();
    } finally {
      await context.close();
    }
  });

  test('F05-E4 no prediction page shows NaN, Infinity, undefined or null for the seeded runner either', async ({ browser, baseURL, guard }) => {
    const context = await contextFor(browser, 'a', baseURL as string, guard);
    try {
      const page = await context.newPage();
      for (const distance of DISTANCES) {
        await page.goto(`/prediction/${distance.key}`);
        await expect(page.getByRole('heading', { level: 1, name: 'Race Time Prediction' })).toBeVisible();
        await page.waitForTimeout(500);
        expect(await mainText(page)).not.toMatch(/NaN|Infinity|undefined|\bnull\b/);
      }
    } finally {
      await context.close();
    }
  });

  test('F05-E5 an unknown distance in the address does not break the app', async ({ browser, baseURL, guard }) => {
    const context = await contextWith(browser, p, baseURL as string, guard);
    try {
      const page = await context.newPage();
      await page.goto('/prediction/banana');
      await page.waitForTimeout(1500);
      await expect(page.locator('body')).not.toContainText(/NaN|undefined/);
      expect(await page.locator('body').innerText()).not.toBe('');
    } finally {
      await context.close();
    }
  });

  test('F05-E6 another runner\'s runs are not counted: B has zero samples while P and A have runs', async ({ browser, baseURL, guard }) => {
    const context = await contextFor(browser, 'b', baseURL as string, guard);
    try {
      const page = await context.newPage();
      await page.goto('/prediction/10k');
      await expect(page.getByRole('region', { name: 'Supporting Evidence' }).getByRole('article').filter({ hasText: 'Samples' }).locator('strong')).toHaveText('0');
    } finally {
      await context.close();
    }
  });
});

test.describe('F05 whole page', () => {
  test('F05-E7 the prediction page has no serious accessibility violations', async ({ browser, baseURL, guard }) => {
    const context = await contextWith(browser, p, baseURL as string, guard);
    try {
      const page = await context.newPage();
      await page.goto('/prediction/10k');
      await expect(page.getByRole('heading', { level: 1, name: 'Race Time Prediction' })).toBeVisible();
      expect(await a11yViolations(page)).toEqual([]);
    } finally {
      await context.close();
    }
  });

  test('F05-E8 the prediction history chart has a text alternative', async ({ browser, baseURL, guard }) => {
    const context = await contextWith(browser, p, baseURL as string, guard);
    try {
      const page = await context.newPage();
      await page.goto('/prediction/10k');
      await expect(page.getByRole('heading', { level: 2, name: 'Prediction History' })).toBeVisible();
      expect(await a11yViolations(page, { onlyRules: ['role-img-alt'] })).toEqual([]);
      await expect(page.locator('canvas[role="img"]').first()).toHaveAttribute('aria-label', /^10K predicted time over the last 90 days, \d+ points, from \d+:\d\d(:\d\d)? to \d+:\d\d(:\d\d)?$/);
    } finally {
      await context.close();
    }
  });

  test('F05-E9 in Chinese the prediction page shows no raw translation key', async ({ browser, baseURL, guard }) => {
    const context = await contextWith(browser, p, baseURL as string, guard);
    try {
      const page = await context.newPage();
      await page.addInitScript(() => localStorage.setItem('hermes_lang', 'zh-CN'));
      await page.goto('/prediction/half');
      await page.waitForTimeout(1500);
      await expectNoRawKeys(page);
      expect(await mainText(page)).not.toMatch(/Race Time Prediction/);
    } finally {
      await context.close();
    }
  });

  test('F05-E10 @mobile the prediction page fits a phone', async ({ browser, baseURL, guard }) => {
    const context = await contextWith(browser, p, baseURL as string, guard);
    try {
      const page = await context.newPage();
      await page.goto('/prediction/5k');
      await expect(page.getByRole('heading', { level: 1, name: 'Race Time Prediction' })).toBeVisible();
      await expectNoHorizontalOverflow(page);
    } finally {
      await context.close();
    }
  });
});

test.describe('F05 history, and the Race row of the effort ladder (found in the first test pass, fixed)', () => {
  test('F05-E16 the first point of the Prediction History is what the runner could run then, not what the best run of the last six months says', async ({ browser, baseURL, guard }) => {
    const made = await newRunner('history');
    // 5 km at 6:20, 5:50, 5:20 and 5:00 per km, 70, 40, 14 and 4 days ago: a runner who got six minutes faster in ten weeks.
    for (const [days, pace] of [[70, 380], [40, 350], [14, 320], [4, 300]] as const) {
      await made.api.importRun(`h-${days}.gpx`, gpxRun({ name: `E2E history ${days}`, start: daysAgo(days), distanceM: 5000, pace }));
    }
    const context = await contextWith(browser, { token: made.api.token as string, email: made.email }, baseURL as string, guard);
    try {
      const page = await context.newPage();
      await page.goto('/prediction/5k');
      await expect(page.getByRole('heading', { level: 2, name: 'Prediction History' })).toBeVisible();
      const label = (await page.locator('canvas[role="img"]').first().getAttribute('aria-label')) ?? '';
      const ends = label.match(/from (\S+) to (\S+)$/);
      expect(ends, label).toBeTruthy();
      // A 5K at 6:20 /km is 31:40: ten weeks ago the runner could not have been predicted a 26:35.
      expect(toSeconds(ends![1]), `first point of: ${label}`).toBeGreaterThan(toSeconds('30:00'));
    } finally {
      await context.close();
    }
  });

  test('F05-E11 the "Race" row of Pace by Effort agrees with the race prediction above it', async ({ browser, baseURL, guard }) => {
    const context = await contextWith(browser, p, baseURL as string, guard);
    try {
      const page = await context.newPage();
      await page.goto('/prediction/marathon');
      const headline = toSeconds(await page.locator('main strong').filter({ hasText: /^\d+:\d\d(?::\d\d)?$/ }).first().innerText());
      const row = page.locator('aside').getByRole('listitem').filter({ hasText: 'Race' });
      const time = toSeconds((await row.locator('strong').last().innerText()).trim());
      expect(Math.abs(time - headline) / headline, `marathon: effort table says ${time}s, headline says ${headline}s`).toBeLessThan(0.05);
    } finally {
      await context.close();
    }
  });
});

test.describe('F05 the prediction history range (M8)', () => {
  /** Four 5K runs a runner got faster over: 31:40, 29:10, 26:40 and 25:00, 70, 40, 14 and 4 days ago. */
  async function runnerWithHistory(label: string) {
    const made = await newRunner(label);
    for (const [days, pace] of [[70, 380], [40, 350], [14, 320], [4, 300]] as const) {
      await made.api.importRun(`range-${days}.gpx`, gpxRun({ name: `E2E range ${days}`, start: daysAgo(days), distanceM: 5000, pace }));
    }
    return made;
  }

  const card = (page: Page) => page.locator('.prediction-trend-card');
  const pointsOf = async (page: Page) => Number(/(\d+) data points/i.exec(await card(page).innerText())?.[1]);

  test('F05-H6 the history switches between 1, 3 and 6 months: each range keeps the points inside it and says so', async ({ browser, baseURL, guard }) => {
    const made = await runnerWithHistory('range');
    const context = await contextWith(browser, { token: made.api.token as string, email: made.email }, baseURL as string, guard);
    try {
      const page = await context.newPage();
      await page.goto('/prediction/5k');
      const group = page.getByRole('group', { name: 'Prediction history range' });
      await expect(group.getByRole('button', { name: '3 months' })).toHaveAttribute('aria-pressed', 'true');
      await expect(card(page)).toContainText('Last 90 days');
      expect(await pointsOf(page), 'three months: all four runs').toBe(4);
      const threeMonths = (await page.locator('canvas[role="img"]').first().getAttribute('aria-label')) ?? '';
      expect(threeMonths).toMatch(/over the last 90 days, 4 points/);

      await group.getByRole('button', { name: '1 month' }).click();
      await expect(group.getByRole('button', { name: '1 month' })).toHaveAttribute('aria-pressed', 'true');
      await expect(card(page)).toContainText('Last 30 days');
      expect(await pointsOf(page), 'one month: the runs of 14 and 4 days ago').toBe(2);
      const oneMonth = (await page.locator('canvas[role="img"]').first().getAttribute('aria-label')) ?? '';
      expect(oneMonth).toMatch(/over the last 30 days, 2 points/);
      // The month starts from the 14 days ago point (26:40-ish), not from the 70 days ago one (31:40).
      const monthStart = oneMonth.match(/from (\S+) to (\S+)$/);
      expect(toSeconds(monthStart![1])).toBeLessThan(toSeconds('28:30'));

      await group.getByRole('button', { name: '6 months' }).click();
      await expect(card(page)).toContainText('Last 180 days');
      expect(await pointsOf(page)).toBe(4);
    } finally {
      await context.close();
    }
  });

  test('F05-H7 the choice is kept for the next visit, and a month with no runs says so and offers a longer range', async ({ browser, baseURL, guard }) => {
    const runner = await newRunner('range-empty');
    // Two runs, 60 and 50 days ago: nothing in the last month.
    for (const days of [60, 50]) {
      await runner.api.importRun(`quiet-${days}.gpx`, gpxRun({ name: `E2E quiet ${days}`, start: daysAgo(days), distanceM: 5000, pace: 330 }));
    }
    const context = await contextWith(browser, { token: runner.api.token as string, email: runner.email }, baseURL as string, guard);
    try {
      const page = await context.newPage();
      await page.goto('/prediction/5k');
      const group = page.getByRole('group', { name: 'Prediction history range' });
      await group.getByRole('button', { name: '1 month' }).click();
      await expect(card(page)).toContainText('No predictions in the last 30 days');
      await expect(card(page)).toContainText('Choose a longer range');
      await expect(page.locator('canvas[role="img"]')).toHaveCount(0);
      await page.reload();
      await expect(page.getByRole('group', { name: 'Prediction history range' }).getByRole('button', { name: '1 month' })).toHaveAttribute('aria-pressed', 'true');
      await page.getByRole('group', { name: 'Prediction history range' }).getByRole('button', { name: '6 months' }).click();
      await expect(page.locator('canvas[role="img"]').first()).toBeVisible();
    } finally {
      await context.close();
    }
  });

  test('F05-H8 the range switch is reachable and pressed with the keyboard, in Chinese too', async ({ browser, baseURL, guard }) => {
    const made = await runnerWithHistory('range-keys');
    const context = await contextWith(browser, { token: made.api.token as string, email: made.email }, baseURL as string, guard);
    try {
      const page = await context.newPage();
      await page.addInitScript(() => localStorage.setItem('hermes_lang', 'zh-CN'));
      await page.goto('/prediction/5k');
      const group = page.getByRole('group', { name: '预测历史范围' });
      await expect(group.getByRole('button', { name: '3 个月' })).toHaveAttribute('aria-pressed', 'true');
      await group.getByRole('button', { name: '1 个月' }).focus();
      await page.keyboard.press('Enter');
      await expect(group.getByRole('button', { name: '1 个月' })).toHaveAttribute('aria-pressed', 'true');
      await expect(card(page)).toContainText('过去 30 天');
      await expectNoRawKeys(page);
    } finally {
      await context.close();
    }
  });
});
