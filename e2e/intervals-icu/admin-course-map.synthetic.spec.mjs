// Real synthetic admin authentication and virtual WebAuthn; course responses are in-memory browser fixtures only.
// Geometry here proves UI separation and preservation, never physical alignment of an actual course.
import { test, expect } from '@playwright/test';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { assertSafeBaseUrl, readDisposableStack, installSyntheticMapTiles } from '../fixtures/safety.mjs';
import { assertReleaseStackIdentity } from '../tools/stack-identity.mjs';
import { provisionIsolatedActors } from './provision-isolated.mjs';

const pixel = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l9sAAAAASUVORK5CYII=', 'base64');
const raceId = 'tokyo-marathon';
const livePoints = [{ lat: 35.69, lng: 139.69 }, { lat: 35.71, lng: 139.72 },
  { lat: 35.68, lng: 139.75 }, { lat: 35.66, lng: 139.73 }];
const pendingPoints = [{ lat: 35.69, lng: 139.69 }, { lat: 35.72, lng: 139.71 },
  { lat: 35.70, lng: 139.76 }, { lat: 35.67, lng: 139.74 }];
const fingerprint = points => crypto.createHash('sha256').update(JSON.stringify(points)).digest('hex');

async function syntheticTiles(context, requests) {
  await installSyntheticMapTiles(context, url => requests.push(url));
}

async function vectorMap(page, selector = '.admin-review-preview__map') {
  const map = page.locator(selector).first();
  await expect(map).toBeVisible();
  await expect.poll(() => map.locator('svg path[stroke]').count()).toBeGreaterThan(0);
  await expect(map.locator('.leaflet-image-layer')).toHaveCount(0);
  await expect(map.getByText('OpenStreetMap', { exact: false })).toBeVisible();
  return map;
}

function watchPage(page, errors) {
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(`console: ${message.text()}`); });
  page.on('response', response => { if (response.status() >= 500) errors.push(`HTTP ${response.status()} ${new URL(response.url()).pathname}`); });
}

test('synthetic admin stays in its console; reviewed candidates preserve the live vector course; logout opens landing', async ({ browser, baseURL }, testInfo) => {
  test.setTimeout(120000);
  const state = readDisposableStack({ baseUrl: baseURL });
  assertReleaseStackIdentity(state, process.env.E2E_BACKEND_JAR, state.baseUrl);
  if (!state.admin) throw new Error('Start this named disposable stack with E2E_SYNTHETIC_ADMIN=true.');
  const adminOrigin = assertSafeBaseUrl(`http://localhost:${state.port}`);
  const { fixture, run } = await provisionIsolatedActors();
  expect(fixture.instanceId).toBe(state.instanceId);
  const context = await browser.newContext({ baseURL: adminOrigin, locale: 'en-US', viewport: { width: 1440, height: 1000 } });
  const tileRequests = [];
  const writes = [];
  const errors = [];
  const live = { routePoints: structuredClone(livePoints), routeFingerprint: fingerprint(livePoints),
    source: 'known-official-course:synthetic-test', confidence: 99, alignmentAccepted: true, sourceAvailable: true,
    imageUrl: '/synthetic-source-map.png', previewImageUrl: '/synthetic-source-map.png',
    overlayBounds: { north: 35.73, south: 35.65, east: 139.78, west: 139.67 }, summary: 'Synthetic verified live route — fixture geometry only' };
  const pending = { ...structuredClone(live), source: 'admin-upload', confidence: 96,
    routePoints: structuredClone(pendingPoints), routeFingerprint: fingerprint(pendingPoints), summary: 'Synthetic pending candidate' };
  const course = { raceId, raceName: 'Synthetic Course Review', city: 'Synthetic city', country: 'Fixture',
    lat: 35.69, lng: 139.72, distanceKm: 42.195, updatedAt: new Date().toISOString(),
    live, currentLivePreview: live, pendingPreview: pending };
  const snapshot = JSON.stringify(live);
  const detailResponses = [];
  await syntheticTiles(context, tileRequests);
  await context.route('**/synthetic-source-map.png', route => route.fulfill({ contentType: 'image/png', body: pixel }));
  await context.route('**/api/admin/race-course-maps**', async route => {
    const request = route.request();
    const url = new URL(request.url());
    if (request.method() === 'POST') {
      writes.push({ path: url.pathname, body: request.postDataJSON() });
      if (url.pathname !== `/api/admin/race-course-maps/${raceId}/pending/reanalyze`) {
        throw new Error('The synthetic browser test must not publish or scan a course.');
      }
      pending.summary = 'Synthetic candidate re-analysis completed';
      pending.routePoints = [...structuredClone(pendingPoints), { lat: 35.665, lng: 139.735 }];
      pending.routeFingerprint = fingerprint(pending.routePoints);
      await route.fulfill({ json: { jobId: 'synthetic-course-review' } });
    } else if (url.pathname.endsWith('/scan-timeline')) {
      await route.fulfill({ json: [] });
    } else if (url.pathname === '/api/admin/race-course-maps') {
      await route.fulfill({ json: [course] });
    } else {
      detailResponses.push(structuredClone(course));
      await route.fulfill({ json: course });
    }
  });
  await context.route('**/api/admin/jobs/synthetic-course-review', route => route.fulfill({ json: {
    id: 'synthetic-course-review', type: 'COURSE_MAP_PREVIEW_REANALYZE', status: 'COMPLETED',
    summary: 'Synthetic candidate re-analysis completed', progressPercent: 100,
  } }));
  const page = await context.newPage();
  watchPage(page, errors);
  const cdp = await context.newCDPSession(page);
  await cdp.send('WebAuthn.enable');
  const { authenticatorId } = await cdp.send('WebAuthn.addVirtualAuthenticator', { options: { protocol: 'ctap2', transport: 'internal',
    hasResidentKey: true, hasUserVerification: true, isUserVerified: true, automaticPresenceSimulation: true } });
  const credentialFile = path.join(run, 'synthetic-admin-passkey.json');
  const saved = fs.existsSync(credentialFile) ? JSON.parse(fs.readFileSync(credentialFile, 'utf8')) : null;
  if (saved) {
    expect(saved.isolation).toBe('ephemeral-h2'); expect(saved.instanceId).toBe(state.instanceId);
    for (const credential of saved.credentials) await cdp.send('WebAuthn.addCredential', { authenticatorId, credential });
  }
  const saveVirtualPasskey = async () => {
    const { credentials } = await cdp.send('WebAuthn.getCredentials', { authenticatorId });
    expect(credentials.length).toBeGreaterThan(0);
    fs.writeFileSync(credentialFile, JSON.stringify({ isolation: 'ephemeral-h2', instanceId: state.instanceId, credentials }), { mode: 0o600 });
  };
  try {
    await page.addInitScript(() => { localStorage.setItem('hermes_lang', 'en'); });
    await page.goto('/login');
    await page.locator('#email').fill(state.admin.email);
    await page.locator('#password').fill(state.admin.password);
    await page.getByRole('button', { name: 'Sign In', exact: true }).click();
    if (saved) {
      await page.getByRole('button', { name: 'Verify with passkey', exact: true }).click();
    } else {
      await page.locator('#admin-bootstrap-token').fill(state.admin.bootstrapToken);
      await page.getByRole('button', { name: 'Create admin passkey', exact: true }).click();
      await expect(page.getByRole('button', { name: 'I saved the codes — continue', exact: true })).toBeVisible();
      await saveVirtualPasskey();
      await page.getByRole('button', { name: 'I saved the codes — continue', exact: true }).click();
    }
    await expect(page).toHaveURL(`${adminOrigin}/dashboard`);
    await saveVirtualPasskey();
    await page.goto('/profile');
    await expect(page).toHaveURL(`${adminOrigin}/dashboard`);
    await page.goto('/dashboard/course-maps');
    await page.getByRole('searchbox', { name: 'Search race, city, or country' }).fill('Synthetic Course Review');
    await page.getByRole('button', { name: /Synthetic Course Review/ }).click();
    await expect(page.getByRole('heading', { name: 'Synthetic Course Review', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Live on app', exact: true }).click();
    let map = await vectorMap(page);
    const livePath = await map.locator('svg path[stroke]').first().getAttribute('d');
    await page.getByRole('button', { name: 'New preview', exact: true }).click();
    map = await vectorMap(page);
    expect(await map.locator('svg path[stroke]').first().getAttribute('d')).not.toBe(livePath);
    await page.getByRole('button', { name: 'Live on app', exact: true }).click();
    await page.getByRole('button', { name: 'Re-analyze this upload', exact: true }).click();
    await expect.poll(() => writes.length).toBe(1);
    await expect(page.getByRole('button', { name: 'Re-analyze this upload', exact: true })).toBeEnabled();
    map = await vectorMap(page);
    expect(await map.locator('svg path[stroke]').first().getAttribute('d')).toBe(livePath);
    expect(JSON.stringify(live)).toBe(snapshot);
    expect(detailResponses.length).toBeGreaterThan(1);
    for (const response of detailResponses) {
      expect(response.live.routePoints).toEqual(livePoints);
      expect(response.live.routeFingerprint).toBe(fingerprint(livePoints));
      expect(response.pendingPreview.routeFingerprint).not.toBe(response.live.routeFingerprint);
    }
    expect(writes[0].body).not.toHaveProperty('routePoints');
    expect(writes[0].body).not.toHaveProperty('live');
    expect(tileRequests.length).toBeGreaterThan(0);
    await page.screenshot({ path: testInfo.outputPath('synthetic-admin-course-vectors.png') });

    const runner = await browser.newContext({ baseURL: state.baseUrl, viewport: { width: 1440, height: 1000 } });
    try {
      await syntheticTiles(runner, tileRequests);
      await runner.addInitScript(actor => {
        localStorage.setItem('hermes_jwt', actor.token); localStorage.setItem('hermes_email', actor.email);
        localStorage.setItem('hermes_lang', 'en');
      }, fixture.actors.athlete);
      await runner.route('**/api/races/course-map?**', route => route.fulfill({ json: { ...live, routeAvailable: true } }));
      await runner.route('**/api/races/elevation-profile?**', route => route.fulfill({ json: { profileSamples: [] } }));
      const runnerPage = await runner.newPage();
      watchPage(runnerPage, errors);
      await runnerPage.goto(`/races/details/${raceId}`);
      const runnerMap = await vectorMap(runnerPage, '.race-detail-map-leaflet');
      const beforePan = await runnerMap.locator('.leaflet-map-pane').getAttribute('style');
      const bounds = await runnerMap.boundingBox();
      await runnerPage.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
      await runnerPage.mouse.down();
      await runnerPage.mouse.move(bounds.x + bounds.width / 2 + 70, bounds.y + bounds.height / 2 + 45, { steps: 8 });
      await runnerPage.mouse.up();
      await expect.poll(() => runnerMap.locator('.leaflet-map-pane').getAttribute('style')).not.toBe(beforePan);
      await expect(runnerMap.locator('.leaflet-image-layer')).toHaveCount(0);
      await runnerPage.screenshot({ path: testInfo.outputPath('synthetic-runner-course-vectors.png') });
    } finally { await runner.close(); }
    await page.getByRole('button', { name: 'Sign out', exact: true }).click();
    await expect(page).toHaveURL(`${adminOrigin}/`);
    await expect(page.locator('#lv3-hero-title')).toBeVisible();
    expect(errors).toEqual([]);
  } finally { await context.close(); }
});
