// F04 Tune zones. Recon path: Settings -> max heart rate or zone boundaries -> save -> the runs follow.
// In HermesRuns: Settings > Training. Unlike Strava, a change recalculates every past run, and the page says so.
// Runner C owns these tests; every test starts from the automatic zones.
import type { Locator, Page } from '@playwright/test';
import { Api, eventually, newRunner } from '../fixtures/api.ts';
import { daysAgo, gpxRun, intervalPace, rollingHills } from '../fixtures/gpx.ts';
import { contextFor, contextWith, expect, signedIn, test } from '../fixtures/test.ts';

test.use({ storageState: signedIn('c') });
test.describe.configure({ mode: 'serial' });

const DEFAULT_MAX = 190;
const AUTO_AT_190 = [114, 133, 152, 171];
const AUTO_AT_185 = [111, 130, 148, 167]; // 60, 70, 80 and 90 % of 185, rounded: 111, 129.5, 148, 166.5

let intervalsId = 0;

async function resetZones(api: Api): Promise<void> {
  const res = await api.put('/api/training/zones', { clearMaxHeartRate: true });
  expect(res.status).toBe(200);
  const back = await api.put('/api/training/zones', { resetHeartRateBoundaries: true });
  expect(back.status).toBe(200);
}

const maxField = (page: Page): Locator => page.getByRole('textbox', { name: 'Max heart rate (bpm)' });
const boundary = (page: Page, zone: 2 | 3 | 4 | 5): Locator => page.getByRole('textbox', { name: `Zone ${zone} starts at (bpm)` });
const zoneList = (page: Page): Locator => page.getByRole('list', { name: 'Your zones' });

async function openTraining(page: Page): Promise<void> {
  await page.goto('/settings?section=training');
  await expect(page.getByRole('heading', { level: 2, name: 'Training zones' })).toBeVisible();
  await expect(maxField(page)).toBeVisible();
}

test.beforeAll(async ({ seed }) => {
  const c = new Api(seed.baseUrl, seed.c.token);
  const existing = (await c.get('/api/activities')).json as Array<{ id: number; name: string }>;
  const found = existing.find((run) => run.name === 'E2E C intervals');
  intervalsId =
    found?.id ??
    (await c.importRun(
      'c-intervals.gpx',
      gpxRun({
        name: 'E2E C intervals',
        start: daysAgo(5),
        distanceM: 6000,
        pace: intervalPace(270, 330, 1000),
        hr: (metres) => (Math.floor(metres / 1000) % 2 === 0 ? 172 : 150),
        elevation: rollingHills(10, 3000),
      }),
    ));
  await resetZones(c);
  await eventually(async () => (await c.get(`/api/activities/${intervalsId}/training-metrics`)).json?.computedAt, 'C\'s run to be analysed');
});

test.beforeEach(async ({ seed }) => {
  await resetZones(new Api(seed.baseUrl, seed.c.token));
});

test.afterAll(async ({ seed }) => {
  await resetZones(new Api(seed.baseUrl, seed.c.token));
});

test.describe('F04 happy path', () => {
  test('F04-H1 a new runner sees the default max heart rate, the automatic zones and what they were worked out from', async ({ page }) => {
    await openTraining(page);
    await expect(maxField(page)).toHaveValue(String(DEFAULT_MAX));
    for (const [index, zone] of ([2, 3, 4, 5] as const).entries()) await expect(boundary(page, zone)).toHaveValue(String(AUTO_AT_190[index]));
    await expect(page.getByRole('button', { name: 'Save', exact: true })).toBeDisabled();
    await expect(page.getByRole('button', { name: 'Save zones' })).toBeDisabled();
    await expect(zoneList(page).getByRole('listitem')).toHaveCount(5);
    await expect(zoneList(page).getByRole('listitem').nth(0)).toContainText('under 114 bpm');
    await expect(zoneList(page).getByRole('listitem').nth(4)).toContainText('171 bpm and up');
    await expect(page.getByText('Changing your zones recalculates the effort and time in zones of all your past runs.')).toBeVisible();
  });

  test('F04-H2 a max heart rate taken from your own runs is offered, and the offer alone changes nothing', async ({ browser, baseURL, seed, guard }) => {
    // Runner A has 21 runs that carry a peak heart rate (the mock Strava runs); the offer needs 20, and runner C has fewer runs.
    const context = await contextFor(browser, 'a', baseURL as string, guard);
    try {
      const page = await context.newPage();
      await openTraining(page);
      await expect(page.getByText(/Your runs point to about \d+ bpm, from the peak heart rate of \d+ recent runs\./)).toBeVisible();
      const offer = page.getByRole('button', { name: /^Use \d+ bpm$/ });
      const offered = Number((await offer.innerText()).replace(/\D/g, ''));
      expect(offered).toBeGreaterThanOrEqual(150);
      expect(offered).toBeLessThanOrEqual(230);
      await expect(maxField(page)).toHaveValue('192'); // what the runner has set; the offer changed nothing
      const stored = (await new Api(seed.baseUrl, seed.a.token).get('/api/training/zones')).json;
      expect(stored.maxHeartRate).toEqual({ bpm: 192, source: 'PROFILE' });
      // The button saves at once (no Save step), so it is not clicked here: this runner's zones belong to every other spec.
      await expect(offer).toBeEnabled();
      await page.reload();
      await expect(maxField(page)).toHaveValue('192');
    } finally {
      await context.close();
    }
  });

  test('F04-H2b a runner whose heart rate comes only from GPX streams is offered a max heart rate from them', async ({ browser, baseURL, guard }) => {
    // A GPX file states no summary, only a stream of readings; the import works the peak out, so these runs count towards the offer
    // (it needs 20 runs with a peak).
    const made = await newRunner('gpxpeak');
    for (let index = 0; index < 20; index += 1) {
      await made.api.importRun(`peak-${index}.gpx`, gpxRun({ name: `F04 peak run ${index}`, start: daysAgo(2 + index), distanceM: 3000, pace: 330, hr: 170 + (index % 8) }));
    }
    const context = await contextWith(browser, { token: made.api.token as string, email: made.email }, baseURL as string, guard);
    try {
      const page = await context.newPage();
      await openTraining(page);
      await expect(page.getByText(/Your runs point to about \d+ bpm, from the peak heart rate of 20 recent runs\./)).toBeVisible();
    } finally {
      await context.close();
    }
  });

  test('F04-H3 a new max heart rate moves the automatic boundaries to the same percentages, and the list says so', async ({ page, seed }) => {
    await openTraining(page);
    await maxField(page).fill('185');
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    for (const [index, zone] of ([2, 3, 4, 5] as const).entries()) await expect(boundary(page, zone)).toHaveValue(String(AUTO_AT_185[index]));
    await expect(zoneList(page).getByRole('listitem').nth(1)).toContainText(`${AUTO_AT_185[0]}–${AUTO_AT_185[1] - 1} bpm`);
    const stored = (await new Api(seed.baseUrl, seed.c.token).get('/api/training/zones')).json;
    expect(stored.maxHeartRate.bpm).toBe(185);
    expect(stored.heartRate.boundaries).toEqual(AUTO_AT_185);
    await page.reload();
    await expect(maxField(page)).toHaveValue('185');
  });

  test('F04-H4 changing the max heart rate recalculates a past run: its zones and effort follow', async ({ page, seed }) => {
    const c = new Api(seed.baseUrl, seed.c.token);
    const before = (await c.get(`/api/activities/${intervalsId}/training-metrics`)).json;
    // Default zones: 150 bpm is zone 3 (133-151) and 172 bpm is zone 5 (171 and up).
    expect(before.heartRate.zones.find((zone: { zone: number; seconds: number }) => zone.zone === 3).seconds).toBeGreaterThan(0);
    expect(before.heartRate.zones.find((zone: { zone: number; seconds: number }) => zone.zone === 4).seconds).toBe(0);
    await openTraining(page);
    await maxField(page).fill('185');
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Save', exact: true })).toBeDisabled();
    // The recalculation runs in the background.
    const after = await eventually(async () => {
      const metrics = (await c.get(`/api/activities/${intervalsId}/training-metrics`)).json;
      return metrics.heartRate.maxHeartRateBpm === 185 ? metrics : null;
    }, 'the past run to be recalculated for max heart rate 185');
    // 150 bpm is now zone 4 (148-166) and 172 is still zone 5 (167 and up).
    expect(after.heartRate.zones.find((zone: { zone: number; seconds: number }) => zone.zone === 3).seconds).toBe(0);
    expect(after.heartRate.zones.find((zone: { zone: number; seconds: number }) => zone.zone === 4).seconds).toBeGreaterThan(0);
    expect(after.effort.score).toBeGreaterThan(before.effort.score);
    await page.goto(`/runs/${intervalsId}`);
    const card = page.getByRole('region', { name: 'Heart-rate zones' });
    await expect(card).toContainText('max heart rate of 185 bpm');
    await expect(card.getByRole('listitem').filter({ hasText: 'Zone 4 · Hard' })).toContainText('148–166 bpm');
    await expect(card.getByRole('listitem').filter({ hasText: 'Zone 3 · Steady' })).not.toContainText('%');
  });

  test('F04-H5 custom boundaries are saved, labelled as yours, and Use default takes you back to the automatic ones', async ({ page, seed }) => {
    await openTraining(page);
    for (const [zone, value] of [[2, '120'], [3, '140'], [4, '160'], [5, '180']] as const) await boundary(page, zone).fill(value);
    await page.getByRole('button', { name: 'Save zones' }).click();
    await expect(page.getByRole('button', { name: 'Save zones' })).toBeDisabled();
    await expect(page.getByText('Your own boundaries.')).toBeVisible();
    await expect(zoneList(page).getByRole('listitem').nth(1)).toContainText('120–139 bpm');
    expect((await new Api(seed.baseUrl, seed.c.token).get('/api/training/zones')).json.heartRate.boundaries).toEqual([120, 140, 160, 180]);

    await page.getByRole('button', { name: 'Back to automatic' }).click();
    await expect(boundary(page, 2)).toHaveValue(String(AUTO_AT_190[0]));
    expect((await new Api(seed.baseUrl, seed.c.token).get('/api/training/zones')).json.heartRate.source).toBe('AUTO');
  });

  test('F04-H6 Use default clears a max heart rate you set', async ({ page, seed }) => {
    const c = new Api(seed.baseUrl, seed.c.token);
    await c.put('/api/training/zones', { maxHeartRateBpm: 200 });
    await openTraining(page);
    await expect(maxField(page)).toHaveValue('200');
    await page.getByRole('button', { name: 'Use default' }).click();
    await expect(maxField(page)).toHaveValue(String(DEFAULT_MAX));
    expect((await c.get('/api/training/zones')).json.maxHeartRate.source).toBe('DEFAULT');
  });
});

test.describe('F04 refused values', () => {
  const refused: Array<[string, string]> = [
    ['more than 230', '231'],
    ['less than 120', '119'],
    ['a fraction', '180.9'],
    ['not a number', 'abc'],
    ['empty', ''],
    ['negative', '-190'],
    ['emoji', '💓'],
  ];
  for (const [index, [label, value]] of refused.entries()) {
    test(`F04-N${index + 1} max heart rate: ${label} is refused with a message and nothing is saved`, async ({ page, seed }) => {
      const puts: string[] = [];
      page.on('request', (request) => {
        if (request.method() === 'PUT' && request.url().includes('/api/training/zones')) puts.push(request.postData() ?? '');
      });
      await openTraining(page);
      await maxField(page).fill(value);
      await expect(page.getByRole('alert').filter({ hasText: 'Enter a whole number from 120 to 230.' })).toBeVisible();
      await expect(maxField(page)).toHaveAttribute('aria-invalid', 'true');
      await expect(page.getByRole('button', { name: 'Save', exact: true })).toBeDisabled();
      expect(puts, 'a value the screen refuses is not sent').toEqual([]);
      expect((await new Api(seed.baseUrl, seed.c.token).get('/api/training/zones')).json.maxHeartRate.source).toBe('DEFAULT');
    });
  }

  const refusedByApi: Array<[string, unknown, RegExp]> = [
    ['231', { maxHeartRateBpm: 231 }, /between 120 and 230/],
    ['119', { maxHeartRateBpm: 119 }, /between 120 and 230/],
    ['180.9', { maxHeartRateBpm: 180.9 }, /whole number/],
  ];
  for (const [index, [label, body, message]] of refusedByApi.entries()) {
    test(`F04-N${20 + index} the API refuses max heart rate ${label} with 400 and says why`, async ({ seed }) => {
      const res = await new Api(seed.baseUrl, seed.c.token).put('/api/training/zones', body);
      expect(res.status).toBe(400);
      expect(res.json.error).toMatch(message);
      expect(res.json.code).toBe('INVALID_ZONES');
    });
  }

  const badBoundaries: Array<[string, [string, string, string, string], string]> = [
    ['equal neighbours', ['120', '120', '160', '180'], 'Each zone must start higher than the one before it.'],
    ['out of order', ['120', '160', '140', '180'], 'Each zone must start higher than the one before it.'],
    ['over the allowed top', ['120', '140', '160', '231'], 'Each boundary must be between 40 and 230 bpm.'],
    ['under the allowed bottom', ['39', '140', '160', '180'], 'Each boundary must be between 40 and 230 bpm.'],
    ['a fraction', ['120.5', '140', '160', '180'], 'Fill in all four boundaries with whole numbers.'],
    ['an empty box', ['120', '', '160', '180'], 'Fill in all four boundaries with whole numbers.'],
  ];
  for (const [index, [label, values, message]] of badBoundaries.entries()) {
    test(`F04-N${8 + index} zone boundaries: ${label} are refused with a message and the old zones stay`, async ({ page, seed }) => {
      const puts: string[] = [];
      page.on('request', (request) => {
        if (request.method() === 'PUT' && request.url().includes('/api/training/zones')) puts.push(request.postData() ?? '');
      });
      await openTraining(page);
      for (const [offset, zone] of ([2, 3, 4, 5] as const).entries()) await boundary(page, zone).fill(values[offset]);
      // The form says what is wrong as soon as it is wrong, marks the boxes, and does not let the runner save.
      await expect(page.getByRole('alert').filter({ hasText: message })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Save zones' })).toBeDisabled();
      await expect(page.locator('input[aria-invalid="true"]').first()).toBeVisible();
      expect(puts, 'boundaries the screen refuses are not sent').toEqual([]);
      expect((await new Api(seed.baseUrl, seed.c.token).get('/api/training/zones')).json.heartRate.boundaries).toEqual(AUTO_AT_190);
    });
  }

  test('F04-N23 the API refuses boundaries that do not increase, are out of range or are not four', async ({ seed }) => {
    const c = new Api(seed.baseUrl, seed.c.token);
    for (const boundaries of [[120, 120, 160, 180], [120, 160, 140, 180], [120, 140, 160, 231], [39, 140, 160, 180], [120, 140, 160]]) {
      const res = await c.put('/api/training/zones', { heartRateBoundaries: boundaries });
      expect(res.status, JSON.stringify(boundaries)).toBe(400);
      expect(res.json.code).toBe('INVALID_ZONES');
    }
    expect((await c.get('/api/training/zones')).json.heartRate.boundaries).toEqual(AUTO_AT_190);
  });
});

test.describe('F04 conditions', () => {
  test('F04-E1 double click on Save sends one request', async ({ page }) => {
    const puts: string[] = [];
    page.on('request', (request) => {
      if (request.method() === 'PUT' && request.url().includes('/api/training/zones')) puts.push(request.postData() ?? '');
    });
    await openTraining(page);
    await maxField(page).fill('188');
    await page.getByRole('button', { name: 'Save', exact: true }).dblclick();
    await expect(page.getByRole('button', { name: 'Save', exact: true })).toBeDisabled();
    expect(puts).toHaveLength(1);
  });

  test('F04-E2 refresh while editing drops the unsaved value and keeps the saved one', async ({ page }) => {
    await openTraining(page);
    await maxField(page).fill('199');
    await page.reload();
    await expect(maxField(page)).toHaveValue(String(DEFAULT_MAX));
  });

  test('F04-E3 two tabs: the last save wins and a reload shows it', async ({ context }) => {
    const first = await context.newPage();
    const second = await context.newPage();
    await openTraining(first);
    await openTraining(second);
    await maxField(first).fill('180');
    await first.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(first.getByRole('button', { name: 'Save', exact: true })).toBeDisabled();
    await maxField(second).fill('195');
    await second.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(second.getByRole('button', { name: 'Save', exact: true })).toBeDisabled();
    await first.reload();
    await expect(maxField(first)).toHaveValue('195');
  });

  test('F04-E4 keyboard only: type a max heart rate, press Enter, and it is saved', async ({ page, seed }) => {
    await openTraining(page);
    await maxField(page).focus();
    await page.keyboard.press('Control+A');
    await page.keyboard.type('187');
    await page.keyboard.press('Enter');
    await expect(page.getByRole('button', { name: 'Save', exact: true })).toBeDisabled();
    expect((await new Api(seed.baseUrl, seed.c.token).get('/api/training/zones')).json.maxHeartRate.bpm).toBe(187);
  });

  test('F04-E5 another runner\'s zones are their own: B is untouched by C\'s changes', async ({ seed }) => {
    const c = new Api(seed.baseUrl, seed.c.token);
    const b = new Api(seed.baseUrl, seed.b.token);
    await c.put('/api/training/zones', { maxHeartRateBpm: 170 });
    const theirs = (await b.get('/api/training/zones')).json;
    expect(theirs.maxHeartRate.source).toBe('DEFAULT');
    expect(theirs.maxHeartRate.bpm).toBe(DEFAULT_MAX);
  });

  test('F04-E6 signed out: the zones cannot be read or changed', async ({ seed }) => {
    const anonymous = new Api(seed.baseUrl, null);
    expect((await anonymous.get('/api/training/zones')).status).toBe(401);
    expect((await anonymous.put('/api/training/zones', { maxHeartRateBpm: 180 })).status).toBe(401);
  });

  test('F04-E7 an empty request, a body of the wrong shape and a huge number are refused, not a 500', async ({ seed }) => {
    const c = new Api(seed.baseUrl, seed.c.token);
    expect([200, 400]).toContain((await c.put('/api/training/zones', {})).status);
    expect((await c.put('/api/training/zones', { maxHeartRateBpm: 1e30 })).status).toBe(400);
    expect((await c.put('/api/training/zones', { maxHeartRateBpm: 'abc' })).status).toBe(400);
    expect((await c.put('/api/training/zones', { heartRateBoundaries: [1, 2, 3] })).status).toBe(400);
    expect((await c.put('/api/training/zones', { heartRateBoundaries: [null, 2, 3, 4] })).status).toBe(400);
    expect((await c.put('/api/training/zones', { maxHeartRateBpm: 180, clearMaxHeartRate: true })).status).toBe(400);
  });

  test('F04-E8 in Chinese the training settings are translated and show no raw key', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('hermes_lang', 'zh-CN'));
    await page.goto('/settings?section=training');
    await expect(page.getByRole('heading', { level: 2, name: '训练区间' })).toBeVisible();
    const text = await page.locator('main').innerText();
    expect(text).not.toMatch(/\b(settings|training|common)\.[a-z0-9_]+/);
  });
});

test.describe('F04 phone width', () => {
  test('F04-E9 @mobile the zones editor fits a 375 px phone', async ({ page }) => {
    await openTraining(page);
    const widths = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, client: document.documentElement.clientWidth }));
    expect(widths.scroll).toBeLessThanOrEqual(widths.client + 1);
    await expect(boundary(page, 5)).toBeVisible();
  });
});
