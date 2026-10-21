import { Api } from '../fixtures/api.ts';
import { test, expect, contextFor } from '../fixtures/test.ts';

test('the packaged release serves every merged analysis API with valid JSON', async ({ api, seed }) => {
  const id = Object.values(seed.ids)[0];
  const routes = [
    '/api/activities/analysis',
    '/api/goals', '/api/goals/suggestions',
    '/api/activities/training-metrics/block?days=28',
    '/api/training/series', '/api/training/weekly-effort?weeks=12',
    '/api/training/intensity?weeks=12', '/api/training/pace-curve?days=90',
    '/api/training/pace-curve?days=all', '/api/training/log?weeks=12',
    '/api/training/best-efforts?distance=5km',
    `/api/activities/${id}/labels`, `/api/activities/${id}/best-efforts`,
    `/api/activities/${id}/matches`, `/api/activities/${id}/training-metrics`,
    `/api/activities/${id}/pace-profile`, `/api/activities/${id}/session-analysis`,
  ];
  for (const route of routes) {
    const answer = await api.get(route);
    expect(answer.status, route).toBe(200);
    expect(answer.headers.get('content-type'), route).toContain('application/json');
    expect(answer.json, route).toBeTruthy();
    expect(answer.json.error, route).toBeUndefined();
  }
});

test('analysis APIs keep authentication, ownership and range validation working', async ({ api, seed }) => {
  const id = Object.values(seed.ids)[0];
  const other = new Api(seed.baseUrl, seed.b.token);
  for (const route of ['/api/training/pace-curve', '/api/training/log', '/api/training/best-efforts', `/api/activities/${id}/labels`]) {
    expect((await api.get(route, { token: null })).status, route).toBe(401);
    expect((await api.get(route, { token: 'expired-analysis-session' })).status, route).toBe(401);
  }
  for (const route of [`/api/activities/${id}/labels`, `/api/activities/${id}/best-efforts`, `/api/activities/${id}/matches`]) {
    expect((await other.get(route)).status, route).toBe(404);
  }
  for (const route of ['/api/training/pace-curve?days=-1', '/api/training/log?weeks=27', '/api/training/intensity?weeks=0', '/api/training/best-efforts?distance=unknown']) {
    expect((await api.get(route)).status, route).toBe(400);
  }
});

test('run labels save, feed the log and quality-session data, and can be cleared', async ({ api, seed }) => {
  const id = Object.values(seed.ids)[0];
  const previous = (await api.get(`/api/activities/${id}/labels`)).json;
  try {
    expect((await api.patch(`/api/activities/${id}`, { runType: 'WORKOUT', tags: ['Release audit'] })).status).toBe(200);
    const saved = await api.get(`/api/activities/${id}/labels`);
    expect(saved.json.runType).toBe('WORKOUT');
    expect(saved.json.tags).toContain('Release audit');
    const analysis = await api.get('/api/activities/analysis');
    expect(analysis.json.find((run: { id: number }) => run.id === id)?.runType).toBe('WORKOUT');
    const log = await api.get('/api/training/log?runType=WORKOUT&tag=Release%20audit');
    expect(log.status).toBe(200);
    expect(JSON.stringify(log.json)).toContain('Release audit');
    expect((await api.patch(`/api/activities/${id}`, { runType: null, tags: [] })).status).toBe(200);
    expect((await api.get(`/api/activities/${id}/labels`)).json.tags).toEqual([]);
  } finally {
    await api.patch(`/api/activities/${id}`, { runType: previous.runType, tags: previous.tags });
  }
});

test('all load-balance charts finish loading in the release', async ({ browser, baseURL, guard }) => {
  const context = await contextFor(browser, 'a', baseURL as string, guard);
  try {
    const page = await context.newPage();
    await page.goto('/analysis/load-balance');
    for (const section of ['load-fitness', 'load-weekly-effort', 'load-intensity']) {
      await expect(page.locator(`#${section} svg`)).toBeVisible();
      await expect(page.locator(`#${section}`).getByRole('button', { name: 'Retry', exact: true })).toHaveCount(0);
    }
  } finally { await context.close(); }
});
