import { Api } from '../fixtures/api.ts';
import { importRunSpecs, sharedRunner } from '../fixtures/analysis.ts';
import { daysAgo } from '../fixtures/gpx.ts';
import { test, expect, contextWith } from '../fixtures/test.ts';

async function runner() {
  return sharedRunner('merged-training', async ({ api }) => {
    const ids = await importRunSpecs(api, [
      { name: 'Ledger sample', daysBack: 2, km: 5, pace: 300, hr: 170 },
      { name: 'Ledger second', daysBack: 10, km: 5, pace: 315, hr: 165 },
      { name: 'Ledger long sample', daysBack: 35, km: 20, pace: 360, hr: 145 },
      { name: 'Historic sample', daysBack: 120, km: 4, pace: 360, hr: 140 },
    ], { wait: false });
    for (const [index, runType, tags] of [
      [0, 'WORKOUT', ['Audit tag', 'common', 'one', 'two', 'three']],
      [1, 'RACE', ['common', 'four', 'five', 'six']],
      [2, null, ['seven', 'eight', 'nine']],
      [3, 'LONG_RUN', ['ten']],
    ] as const) {
      expect((await api.patch(`/api/activities/${ids[index]}`, { runType, tags })).status).toBe(200);
    }
    return { ids };
  });
}

for (const mobile of [false, true]) {
  const prefix = mobile ? '@mobile ' : '';
  const options = mobile
    ? { viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true }
    : { viewport: { width: 1440, height: 900 } };

  test(`${prefix}embedded Training log metrics, history, date jump and type/tag filters`, async ({ browser, baseURL, guard }) => {
    const who = await runner();
    const context = await contextWith(browser, who, baseURL!, guard, options);
    try {
      const page = await context.newPage();
      await page.goto('/training-log');
      const log = page.locator('.training-log-v2');
      await expect(log.locator('[data-week]')).toHaveCount(12);
      for (const metric of ['Distance', 'Time', 'Climb', 'Effort']) {
        const button = log.locator('.training-log-v2__view').getByRole('button', { name: metric, exact: true });
        await button.click();
        await expect(button).toHaveAttribute('aria-pressed', 'true');
        await expect(log.locator('.training-log-v2__strip li.has-runs').first()).toHaveAttribute('title', /.+/);
      }
      await log.getByRole('button', { name: 'Load earlier weeks', exact: true }).click();
      await expect(log.locator('[data-week]')).toHaveCount(24);
      await expect(log.getByRole('link', { name: 'Historic sample', exact: true })).toBeVisible();
      await log.getByLabel('Jump to a date', { exact: true }).fill(daysAgo(120).toISOString().slice(0, 10));
      await expect(log.getByRole('button', { name: 'Show later weeks', exact: true })).toBeVisible();
      const firstWeek = await log.locator('[data-week]').first().getAttribute('data-week');
      await log.getByRole('button', { name: 'Show later weeks', exact: true }).click();
      await expect.poll(() => log.locator('[data-week]').first().getAttribute('data-week')).not.toBe(firstWeek);
      await log.getByRole('button', { name: 'Latest weeks', exact: true }).click();
      await expect(log.getByLabel('Jump to a date', { exact: true })).toHaveValue('');
      const filters = log.locator('.training-log-v2__filters');
      for (const [type, run] of [['Workout', 'Ledger sample'], ['Race', 'Ledger second']]) {
        await filters.getByRole('button', { name: type, exact: true }).click();
        await expect(log.locator('.training-log-v2__run-name')).toHaveCount(1);
        await expect(log.locator('.training-log-v2__run-name')).toHaveText(run);
      }
      await filters.getByRole('button', { name: 'Long run', exact: true }).click();
      await expect(log.locator('.training-log-v2__run-name')).toHaveCount(0);
      await log.getByRole('button', { name: 'Load earlier weeks', exact: true }).click();
      await expect(log.locator('.training-log-v2__run-name')).toHaveCount(1);
      await expect(log.locator('.training-log-v2__run-name')).toHaveText('Historic sample');
      await filters.getByRole('button', { name: 'Clear filters', exact: true }).click();
      await filters.getByRole('button', { name: /^Show all \d+ tags$/ }).click();
      await expect(filters.getByRole('button', { name: 'Show fewer tags', exact: true })).toHaveAttribute('aria-expanded', 'true');
      await filters.getByRole('button', { name: /^common\s*2$/ }).click();
      await expect(log.locator('.training-log-v2__run-name')).toHaveCount(2);
      await filters.getByRole('button', { name: /^Audit tag\s*1$/ }).click();
      await expect(log.locator('.training-log-v2__run-name')).toHaveCount(1);
      await expect(log.locator('.training-log-v2__run-name')).toHaveText('Ledger sample');
      await filters.getByRole('button', { name: 'Clear filters', exact: true }).click();
      await filters.getByRole('button', { name: 'Show fewer tags', exact: true }).click();
      await log.getByRole('link', { name: 'Ledger sample', exact: true }).click();
      await expect(page).toHaveURL(new RegExp(`/runs/${who.meta.ids[0]}$`));
      await expect(page.locator('.run-labels')).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    } finally { await context.close(); }
  });

  test(`${prefix}embedded Quality sessions shows manual and automatic sessions in every period`, async ({ browser, baseURL, guard }) => {
    const who = await runner();
    const context = await contextWith(browser, who, baseURL!, guard, options);
    try {
      const page = await context.newPage();
      await page.goto('/analysis/quality-sessions');
      const quality = page.locator('.quality-sessions-v2');
      await expect(quality.locator('tbody tr')).toHaveCount(2);
      await quality.getByRole('button', { name: 'Long runs', exact: true }).click();
      await expect(quality.locator('tbody tr')).toHaveCount(3);
      await expect(quality.locator('tbody tr').filter({ hasText: 'Ledger long sample' })).toContainText('Automatic');
      for (const [range, count] of [['6 months', 4], ['1 year', 4], ['All time', 4], ['3 months', 3]] as const) {
        const button = quality.getByRole('button', { name: range, exact: true });
        await button.click();
        await expect(button).toHaveAttribute('aria-pressed', 'true');
        await expect(quality.locator('tbody tr')).toHaveCount(count);
        await expect(quality.locator('.quality-sessions-v2__reads > div').first().locator('strong')).toHaveText(String(count));
      }
      for (const type of ['Workouts', 'Races', 'Long runs']) await quality.getByRole('button', { name: type, exact: true }).click();
      await expect(quality.getByRole('heading', { name: 'No type is on', exact: true })).toBeVisible();
      await quality.getByRole('button', { name: 'Long runs', exact: true }).click();
      await quality.getByRole('link', { name: 'Ledger long sample', exact: true }).click();
      await expect(page).toHaveURL(new RegExp(`/runs/${who.meta.ids[2]}$`));
      expect((await who.api.get(`/api/activities/${who.meta.ids[2]}/labels`)).json.runType).toBeNull();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    } finally { await context.close(); }
  });

  test(`${prefix}run type/tags and goals save through the current Runs page`, async ({ browser, baseURL, guard }) => {
    const who = await runner();
    const context = await contextWith(browser, who, baseURL!, guard, options);
    const id = who.meta.ids[0];
    const previous = (await who.api.get(`/api/activities/${id}/labels`)).json;
    try {
      const page = await context.newPage();
      await page.goto(`/runs/${id}`);
      const labels = page.locator('.run-labels');
      await labels.getByRole('radio', { name: 'Race', exact: true }).check();
      await expect.poll(async () => (await who.api.get(`/api/activities/${id}/labels`)).json.runType).toBe('RACE');
      await labels.getByLabel('Add a tag', { exact: true }).fill('UI saved');
      await labels.getByRole('button', { name: 'Add tag', exact: true }).click();
      await expect.poll(async () => (await who.api.get(`/api/activities/${id}/labels`)).json.tags).toContain('UI saved');
      await labels.getByRole('button', { name: 'Remove tag UI saved', exact: true }).click();
      await expect.poll(async () => (await who.api.get(`/api/activities/${id}/labels`)).json.tags).not.toContain('UI saved');
      await labels.getByRole('radio', { name: 'Just a run', exact: true }).check();
      await expect.poll(async () => (await who.api.get(`/api/activities/${id}/labels`)).json.runType).toBeNull();
      await labels.getByRole('link', { name: 'See your tagged runs in the training log', exact: true }).click();
      const goals = page.locator('#training-log .goals-v2');
      await goals.getByRole('button', { name: 'Set a goal', exact: true }).click();
      const dialog = page.getByRole('dialog');
      await dialog.getByRole('button', { name: 'Save goal', exact: true }).click();
      await expect(dialog.getByRole('alert')).toHaveText('Enter a target.');
      await dialog.getByLabel('Target', { exact: true }).fill('40');
      await dialog.getByRole('button', { name: 'Save goal', exact: true }).click();
      await expect(dialog).toHaveCount(0);
      const saved = (await who.api.get('/api/goals')).json.goals.find((g: any) => g.period === 'WEEK' && g.metric === 'DISTANCE');
      expect(saved.target).toBe(40);
      await goals.getByRole('button', { name: 'Change the target of Weekly distance', exact: true }).click();
      await dialog.getByLabel('Target', { exact: true }).fill('50');
      await dialog.getByRole('button', { name: 'Save goal', exact: true }).click();
      await expect(dialog).toHaveCount(0);
      expect((await who.api.get('/api/goals')).json.goals.find((g: any) => g.id === saved.id).target).toBe(50);
      await goals.getByRole('button', { name: 'Delete Weekly distance', exact: true }).click();
      await goals.getByRole('button', { name: 'Keep it', exact: true }).click();
      await expect(goals.getByRole('button', { name: 'Delete Weekly distance', exact: true })).toBeVisible();
      expect((await who.api.get(`/api/goals?runId=${id}`)).status).toBe(200);
      await goals.getByRole('button', { name: 'Delete Weekly distance', exact: true }).click();
      await goals.getByRole('button', { name: 'Yes, delete', exact: true }).click();
      await expect(goals.locator('.goals-v2__list')).toHaveCount(0);
      expect((await who.api.get('/api/goals')).json.goals).toEqual([]);
    } finally {
      await who.api.patch(`/api/activities/${id}`, { runType: previous.runType, tags: previous.tags });
      const all = (await who.api.get('/api/goals')).json.goals;
      for (const goal of all) await who.api.delete(`/api/goals/${goal.id}`);
      await context.close();
    }
  });
}

test('merged training API validation and goal ownership remain enforced', async ({ seed }) => {
  const who = await runner();
  const other = new Api(seed.baseUrl, seed.b.token);
  const id = who.meta.ids[0];
  for (const route of ['/api/goals', '/api/goals/suggestions', `/api/goals?runId=${id}`, '/api/training/log', `/api/activities/${id}/labels`, `/api/activities/${id}/best-efforts`, '/api/training/best-efforts?distance=5km']) {
    expect((await who.api.get(route)).status, route).toBe(200);
    expect((await who.api.get(route, { token: null })).status, route).toBe(401);
  }
  const unrelated = await other.get(`/api/goals?runId=${id}`);
  expect(unrelated.status).toBe(200);
  expect(unrelated.json).toEqual((await other.get('/api/goals')).json);
  expect((await other.patch(`/api/activities/${id}`, { runType: 'RACE' })).status).toBe(404);
  expect((await who.api.post('/api/goals', { period: 'WEEK', metric: 'DISTANCE', target: -1 })).status).toBe(400);
  const created = await who.api.post('/api/goals', { period: 'WEEK', metric: 'DISTANCE', target: 40 });
  expect(created.status).toBe(201);
  const goal = created.json.goals.find((g: any) => g.period === 'WEEK' && g.metric === 'DISTANCE');
  try {
    expect((await who.api.post('/api/goals', { period: 'WEEK', metric: 'DISTANCE', target: 50 })).status).toBe(409);
    expect((await other.put(`/api/goals/${goal.id}`, { target: 70 })).status).toBe(404);
    expect((await other.delete(`/api/goals/${goal.id}`)).status).toBe(404);
  } finally { expect((await who.api.delete(`/api/goals/${goal.id}`)).status).toBe(200); }
});
