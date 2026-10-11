// P03 The Strava connection: disconnecting must delete what came from Strava's API, and events Strava sends (unsigned) must not be
// able to delete a runner's data on their own. The recon's prerequisite 2 and rule 6 of the API policy. Numbered P03.
//
// The seeded runner A is the only runner with Strava-sourced runs (the 21 mock runs). Tests that change that carry @destructive and
// run only with E2E_DESTRUCTIVE=1; restart the stack afterwards (npm run stack:stop && npm run stack:start) before another full run.
import { Api } from '../fixtures/api.ts';
import { expect, test } from '../fixtures/test.ts';

const ATHLETE_ID = 140971747;

const post = (api: Api, route: string, body: unknown) =>
  fetch(`${api.baseUrl}${route}`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': api.clientIp ?? '' }, body: JSON.stringify(body) });

test.describe('P03 events and handshakes from Strava', () => {
  test('P03-N1 the subscription handshake is refused without the right verify token', async ({ seed }) => {
    const api = new Api(seed.baseUrl);
    for (const query of [
      'hub.mode=subscribe&hub.verify_token=wrong&hub.challenge=abc',
      'hub.mode=subscribe&hub.verify_token=&hub.challenge=abc',
      'hub.mode=unsubscribe&hub.verify_token=hermes-strava-webhook&hub.challenge=abc',
      'hub.mode=subscribe&hub.verify_token=hermes-strava-webhook&hub.challenge=abc',
    ]) {
      const res = await fetch(`${api.baseUrl}/api/strava/webhook?${query}`, { headers: { 'X-Forwarded-For': api.clientIp ?? '' } });
      expect(res.status, query).toBe(403);
      expect(await res.text()).not.toContain('abc');
    }
    const missing = await fetch(`${api.baseUrl}/api/strava/webhook`, { headers: { 'X-Forwarded-For': api.clientIp ?? '' } });
    expect(missing.status).toBeLessThan(500);
  });

  test('P03-N2 a forged "activity deleted" or "athlete deauthorised" event for a real athlete id does not delete or purge anything', async ({ seed }) => {
    const a = new Api(seed.baseUrl, seed.a.token);
    const before = ((await a.get('/api/activities')).json as Array<{ id: number; stravaId: string | null }>);
    const events = [
      { object_type: 'activity', object_id: 1, aspect_type: 'delete', owner_id: ATHLETE_ID, subscription_id: 1, event_time: 1 },
      ...before.filter((run) => /^\d+$/.test(run.stravaId ?? '')).slice(0, 3).map((run) => ({ object_type: 'activity', object_id: Number(run.stravaId), aspect_type: 'delete', owner_id: ATHLETE_ID })),
      { object_type: 'athlete', object_id: ATHLETE_ID, aspect_type: 'update', owner_id: ATHLETE_ID, updates: { authorized: 'false' } },
    ];
    for (const event of events) {
      const res = await post(a, '/api/strava/webhook', event);
      expect(res.status, JSON.stringify(event)).toBeLessThan(500);
      await res.text();
    }
    await new Promise((resolve) => setTimeout(resolve, 2500)); // events are handled in the background
    const after = ((await a.get('/api/activities')).json as unknown[]).length;
    expect(after, 'runs after forged events').toBe(before.length);
    expect((await a.get('/api/auth/protected/ping')).status).toBe(200);
  });

  test('P03-N3 events with an unknown owner, a missing field, bad JSON or the wrong type are ignored or refused, never a 500', async ({ seed }) => {
    const api = new Api(seed.baseUrl);
    for (const event of [
      { object_type: 'activity', object_id: 5, aspect_type: 'create', owner_id: 999999999 },
      { object_type: 'activity', aspect_type: 'create' },
      {},
      [],
      'text',
      { object_type: 'activity', object_id: 'x'.repeat(5000), aspect_type: 'create', owner_id: ATHLETE_ID },
    ]) {
      const res = await post(api, '/api/strava/webhook', event);
      expect(res.status, JSON.stringify(event).slice(0, 80)).toBeLessThan(500);
      await res.text();
    }
    const broken = await fetch(`${api.baseUrl}/api/strava/webhook`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': api.clientIp ?? '' }, body: '{not json' });
    expect(broken.status).toBeLessThan(500);
  });

  test('P03-N4 Strava is not connected for the seeded runner, and the screens say so instead of offering a disconnect', async ({ seed }) => {
    const a = new Api(seed.baseUrl, seed.a.token);
    const status = (await a.get('/api/auth/strava/status')).json;
    expect(status.linked).toBe(false);
  });
});

test.describe('P03 disconnecting @destructive', () => {
  test.skip(!process.env.E2E_DESTRUCTIVE, 'changes the seeded runner: set E2E_DESTRUCTIVE=1, and restart the stack afterwards');

  test('P03-H1 Disconnect removes the runs that came from Strava, keeps the files the runner imported, and can be repeated', async ({ seed }) => {
    const a = new Api(seed.baseUrl, seed.a.token);
    const b = new Api(seed.baseUrl, seed.b.token);
    const c = new Api(seed.baseUrl, seed.c.token);
    const others = ((await b.get('/api/activities')).json as unknown[]).length + ((await c.get('/api/activities')).json as unknown[]).length;
    const before = (await a.get('/api/activities')).json as Array<{ id: number; provider: string }>;
    const fromFiles = before.filter((run) => run.provider !== 'STRAVA').length;
    expect(fromFiles).toBeGreaterThanOrEqual(11);

    const first = await a.delete('/api/auth/strava/unlink');
    expect(first.status).toBe(200);
    expect(first.json.unlinked).toBe(true);
    const after = (await a.get('/api/activities')).json as Array<{ id: number; provider: string }>;
    expect(after.filter((run) => run.provider !== 'STRAVA').length, 'the files the runner imported stay').toBe(fromFiles);
    expect(after.length, 'runs left after disconnecting').toBeLessThanOrEqual(before.length);
    expect(first.json.removedActivities).toBe(before.length - after.length);

    const second = await a.delete('/api/auth/strava/unlink');
    expect(second.status).toBe(200);
    expect(second.json.removedActivities).toBe(0);
    expect(((await b.get('/api/activities')).json as unknown[]).length + ((await c.get('/api/activities')).json as unknown[]).length).toBe(others);
    expect((await a.get(`/api/activities/${seed.ids.hills}/pace-profile`)).status).toBe(200);
  });
});
