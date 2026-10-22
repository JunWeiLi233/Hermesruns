import fs from 'node:fs';
import path from 'node:path';
import { assertActorFixture, assertPrivateFixtureDirectory, assertSafeBaseUrl, readDisposableStack } from '../fixtures/safety.mjs';

export const actorRoles = ['athlete', 'member', 'coach', 'follower', 'outsider'];

export function loadIsolatedActors(directory, readStack = readDisposableStack) {
  if (!directory) throw Error('Set HERMES_TRAINING_QA_RUN to a disposable actor fixture directory.');
  const run = assertPrivateFixtureDirectory(directory);
  const fixture = JSON.parse(fs.readFileSync(path.join(run, 'actors.json'), 'utf8').replace(/^\uFEFF/, ''));
  const baseUrl = assertSafeBaseUrl(fixture.baseURL);
  const state = readStack({ baseUrl });
  assertActorFixture(fixture, state);
  if (!/^[a-f0-9]{32}$/.test(fixture.tag)) throw Error('Unexpected synthetic fixture tag.');
  for (const role of actorRoles) {
    const actor = fixture.actors?.[role];
    if (actor?.email !== `qa-training-${fixture.tag}-${role}@example.test`
        || typeof actor.token !== 'string' || !actor.token) throw Error('Synthetic actor identity mismatch.');
  }
  return { run, fixture, state, readStack };
}

/** Recheck the recorded H2 instance before every request, including each deletion. */
export function fetchForFixture(context, route, options = {}, fetchImpl = fetch) {
  assertActorFixture(context.fixture, context.readStack({ baseUrl: context.state.baseUrl }));
  const destination = new URL(route, context.state.baseUrl);
  if (destination.origin !== context.state.baseUrl || !destination.pathname.startsWith('/api/')) {
    throw Error('Synthetic fixture requests must stay within the recorded disposable API.');
  }
  return fetchImpl(destination.href, { ...options, redirect: 'error', signal: AbortSignal.timeout(30000) });
}

export async function cleanIsolatedActors(directory, { phase = 'cleanup', readStack, fetchImpl = fetch } = {}) {
  if (!['prepare', 'cleanup', 'verify'].includes(phase)) throw Error('Unknown cleanup phase.');
  const context = loadIsolatedActors(directory, readStack);
  const { run, fixture, state } = context;
  const reportFile = path.join(run, 'cleanup-api-results.json');
  const identity = async role => {
    const actor = fixture.actors[role];
    return fetchForFixture(context, '/api/profile/me', { headers: { Authorization: `Bearer ${actor.token}` } }, fetchImpl);
  };
  if (phase === 'verify') {
    const report = JSON.parse(fs.readFileSync(reportFile, 'utf8'));
    if (report.instanceId !== state.instanceId || report.tag !== fixture.tag
        || report.roles?.join(',') !== actorRoles.join(',')) throw Error('Cleanup report belongs to another fixture.');
    for (const role of actorRoles) if ((await identity(role)).status !== 401) throw Error('Deleted synthetic session remains usable.');
    const result = { instanceId: state.instanceId, syntheticAccountsDeleted: actorRoles.length, allActorSessionsRevoked: true };
    fs.writeFileSync(path.join(run, 'cleanup-verification.json'), JSON.stringify(result, null, 2));
    return result;
  }
  // All five exact identities must match before the first account can be deleted.
  for (const role of actorRoles) {
    const response = await identity(role);
    if (response.status !== 200 || (await response.json()).email !== fixture.actors[role].email) {
      throw Error('Synthetic account identity check failed; no deletion attempted.');
    }
  }
  if (phase === 'prepare') {
    fs.writeFileSync(path.join(run, 'cleanup-prepared.json'), JSON.stringify({ instanceId: state.instanceId, tag: fixture.tag }));
    return { isolated: true, syntheticAccountsReady: actorRoles.length };
  }
  for (const role of actorRoles) {
    const response = await fetchForFixture(context, '/api/training/me', {
      method: 'DELETE', headers: { Authorization: `Bearer ${fixture.actors[role].token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ confirmation: 'DELETE' }),
    }, fetchImpl);
    if (response.status !== 200 || (await response.json()).deleted !== true) throw Error('Synthetic account cleanup failed.');
  }
  const report = { instanceId: state.instanceId, tag: fixture.tag, roles: actorRoles };
  fs.writeFileSync(reportFile, JSON.stringify(report, null, 2));
  return { isolated: true, syntheticAccountsDeleted: actorRoles.length };
}
