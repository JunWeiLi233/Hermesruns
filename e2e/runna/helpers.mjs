import { test as base, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { installSyntheticMapTiles, setBrowserActor, freshSyntheticClientAddress, waitForVisualStability } from '../fixtures/safety.mjs';
export { expect };
export const test = base.extend({
  // Each test is a separate synthetic client behind the isolated trusted loopback proxy.
  // Keep production IP budgets intact while unrelated test scenarios run back to back.
  extraHTTPHeaders: async ({}, use) => {
    await use({ 'X-Forwarded-For': freshSyntheticClientAddress() });
  },
  context: async ({ context }, use) => { await installSyntheticMapTiles(context); await use(context); },
  page: async ({ page }, use, testInfo) => {
    const errors = [];
    const watch = p => {
      p.on('console', msg => {
        const expectedFault = testInfo.annotations.some(a => a.type === 'expected-network-fault') && /^Failed to load resource: net::ERR_/.test(msg.text());
        const expectedExpiry = testInfo.annotations.some(a => a.type === 'expected-http-401') && /^Failed to load resource:.*401/.test(msg.text());
        const expectedConflict = testInfo.annotations.some(a => a.type === 'expected-http-409') && /^Failed to load resource:.*409/.test(msg.text());
        if (msg.type() === 'error' && !expectedFault && !expectedExpiry && !expectedConflict) errors.push(`console: ${msg.text()}`);
      });
      p.on('pageerror', error => errors.push(`pageerror: ${error.message}`));
      p.on('response', response => { if (response.status() >= 500) errors.push(`HTTP ${response.status()} ${response.url()}`); });
    };
    watch(page); page.context().on('page', watch);
    await use(page);
    expect(errors, 'No unexpected console errors, exceptions or 5xx').toEqual([]);
  },
});
export const addDays = (date, n) => { const d = new Date(`${date}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
export const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(new Date());
export function inputs(overrides = {}) {
  return { schemaVersion: 1, title: 'QA – Élan 🏃', goalKind: 'DISTANCE', goalDistanceM: 5000, startDate: today(), endDate: addDays(today(), 83), timeZone: 'America/New_York', adultConfirmed: true, experience: 'BEGINNER', trainingMode: 'RUN_WALK', baselineWeeklyM: 0, baselineRunsPerWeek: 0, longestRecentM: 0, canWalk20Minutes: true, availableWeekdays: [2, 4, 7], runsPerWeek: 3, longRunWeekday: 7, volume: 'STANDARD', difficulty: 'EASY', recentResult: null, eventName: '', units: 'KM', ...overrides };
}
export async function login(request, n = 1, origin = '') {
  const email = n === 0 ? 'plan-browser@hermes.test' : `plan-qa-${n}@hermes.test`;
  const response = await request.post(`${origin}/api/auth/login`, { data: { email, password: 'Hermes-test-only-4320!' } });
  expect(response.status(), await response.text()).toBe(200);
  const auth = await response.json();
  return { email, token: auth.token, headers: { Authorization: `Bearer ${auth.token}` } };
}
export const command = payload => ({ ...payload, clientKey: crypto.randomUUID() });
export async function post(request, auth, path, body, status = 200, origin = '') {
  const response = await request.post(`${origin}${path}`, { headers: auth.headers, data: body });
  expect(response.status(), await response.text()).toBe(status); return response.json();
}
export async function get(request, auth, path, status = 200, origin = '') {
  const response = await request.get(`${origin}${path}`, { headers: auth.headers });
  expect(response.status(), await response.text()).toBe(status); return response.json();
}
export async function candidate(request, auth, i = inputs(), origin = '') {
  const p = await post(request, auth, '/api/run-plans', command({ inputs: i }), 200, origin);
  const v = await post(request, auth, `/api/run-plans/${p.id}/versions`, command({ inputs: i, baseRevision: p.revision }), 200, origin);
  const snapshot = await get(request, auth, `/api/run-plans/${p.id}/versions/${v.id}`, 200, origin);
  return { p, v: snapshot, days: snapshot.weeks.flatMap(w => w.days) };
}
export const activation = v => command({ versionId: v.id, baseRevision: v.baseRevision, contentHash: v.contentHash, activePlanId: v.activePlanId, activePlanRevision: v.activePlanRevision, acknowledgedWarnings: v.warnings });
export async function active(request, auth, i) { const c = await candidate(request, auth, i); await post(request, auth, `/api/run-plans/${c.p.id}/activate`, activation(c.v)); return c; }
export async function manual(request, auth, overrides = {}) {
  return post(request, auth, '/api/manual-runs', command({ name: 'QA actual Élan 🏃', startedAt: new Date(Date.now() - 7200000).toISOString(), timeZone: 'America/New_York', distanceMeters: 2300, elapsedSeconds: 900, ...overrides }), 201);
}
export async function browserLogin(page, request, n = 0, origin = '') {
  const auth = await login(request, n, origin);
  await setBrowserActor(page, auth, origin || test.info().project.use.baseURL);
  return auth;
}
export async function scan(page, name, testInfo) {
  await expect(page.getByRole('main')).toBeVisible();
  await waitForVisualStability(page);
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
  await testInfo.attach(`axe-${name}`, { body: JSON.stringify(results.violations, null, 2), contentType: 'application/json' });
  expect(results.violations.map(v => ({ id: v.id, impact: v.impact, nodes: v.nodes.map(n => ({ target: n.target, summary: n.failureSummary })) })), `axe ${name}`).toEqual([]);
  if (['coaching-gate', 'mobile-candidate', 'actual-backlink'].includes(name)) {
    const path=testInfo.outputPath(`${name}.png`);await page.screenshot({path,fullPage:false});await testInfo.attach(name,{path,contentType:'image/png'});
  }
}
export async function openWorkout(page, c) {
  const w = c.days.find(d => d.workoutType !== 'REST' && d.workoutType !== 'EVENT');
  await page.goto(`/training-plan/${c.p.id}/workouts/${w.id}`);
  await expect(page.getByRole('button', { name: 'Link a completed run', exact: true })).toBeVisible(); return w;
}
