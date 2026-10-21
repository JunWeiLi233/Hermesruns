import { randomUUID } from 'node:crypto';
import { Api, strongPassword } from '../fixtures/api.ts';
import { test, expect } from '../fixtures/test.ts';

test('sport totals include history beyond 200, all sports, and enforce athlete access', async ({ baseURL }) => {
  test.setTimeout(240_000);
  const api = new Api(baseURL as string);
  await api.signUp(`totals-owner-${randomUUID()}@example.test`, strongPassword());
  const me = await api.get('/api/training/me');
  const subject = me.json.id;
  const route = `/api/training/athletes/${subject}/activities/totals?from=2024-01-01&through=2024-01-31`;
  expect((await api.get(route)).status).toBe(200);
  expect((await api.get(`/api/training/athletes/${subject}/activities/totals?from=2024-02-01&through=2024-01-31`)).status).toBe(422);
  expect((await api.get(`/api/training/athletes/${subject}/activities/totals`)).status).toBe(422);
  expect((await new Api(baseURL as string).get(route)).status).toBe(401);
  const stranger = new Api(baseURL as string);
  await stranger.signUp(`totals-${randomUUID()}@example.test`, strongPassword());
  expect((await stranger.get(route)).status).toBe(404);
  const before = (await api.get(route)).json.items.find((row: any) => row.sport === 'Other');
  for (let index = 0; index < 201; index++) {
    const command = {
      headers: { 'Idempotency-Key': randomUUID() },
      body: { title: `Totals regression ${index}`, date: '2024-01-15', minutes: 1, sport: 'Other', rpe: 2 },
    };
    let saved = await api.request('POST', `/api/training/athletes/${subject}/activities/manual`, command);
    if (saved.status === 429) {
      // Respect the production rate limiter while preparing a large disposable history.
      await new Promise(resolve => setTimeout(resolve, 60_250));
      saved = await api.request('POST', `/api/training/athletes/${subject}/activities/manual`, command);
    }
    expect(saved.status).toBe(200);
  }
  const result = await api.get(route);
  expect(result.status).toBe(200);
  const other = result.json.items.find((row: any) => row.sport === 'Other');
  expect(other.sessions - before.sessions).toBe(201);
  expect(other.minutes - before.minutes).toBe(201);
  expect(other.load - before.load).toBe(201);
  expect(result.json.complete).toBe(true);
});
