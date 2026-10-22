#!/usr/bin/env node
// API-only synthetic actors. The legacy provision.ps1 is for a live local DB and must not be used by this suite.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { assertActorFixture, assertPrivateFixtureDirectory, readDisposableStack, repositoryRoot } from '../fixtures/safety.mjs';

export async function provisionIsolatedActors(directory) {
  const state = readDisposableStack(process.env.E2E_BASE_URL ? { baseUrl: process.env.E2E_BASE_URL } : {});
  const run = assertPrivateFixtureDirectory(directory || process.env.HERMES_TRAINING_QA_RUN
    || path.join(repositoryRoot, '.private-backups', 'intervals-icu', state.instanceId));
  const file = path.join(run, 'actors.json');
  if (fs.existsSync(path.join(run, 'cleanup-api-results.json'))) throw new Error('This actor fixture was cleaned up. Use a fresh private directory.');
  if (fs.existsSync(file)) return { run, fixture: assertActorFixture(JSON.parse(fs.readFileSync(file, 'utf8')), state) };
  fs.mkdirSync(run, { recursive: true, mode: 0o700 });
  assertPrivateFixtureDirectory(run);
  const tag = crypto.randomBytes(16).toString('hex');
  const actors = {};
  const call = async (route, body, token) => {
    const current = readDisposableStack({ baseUrl: state.baseUrl });
    if (current.instanceId !== state.instanceId) throw new Error('Disposable stack restarted during provisioning.');
    const response = await fetch(state.baseUrl + route, {
      method: body === undefined ? 'GET' : 'POST', redirect: 'error', signal: AbortSignal.timeout(30000),
      headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}) },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    if (!response.ok) throw new Error(`Synthetic actor provisioning failed at ${route} (HTTP ${response.status}).`);
    return response.json();
  };
  for (const role of ['athlete', 'coach', 'follower', 'outsider', 'member']) {
    const email = `qa-training-${tag}-${role}@example.test`;
    const password = `Aa1!${crypto.randomBytes(18).toString('base64url')}`;
    await call('/api/auth/signup', { email, password });
    const session = await call('/api/auth/login', { email, password });
    if (typeof session.token !== 'string' || !session.token) throw new Error('Synthetic sign-in returned no session.');
    const profile = await call('/api/profile/me', undefined, session.token);
    if (profile.email !== email) throw new Error('Synthetic actor identity did not match the signed-in account.');
    const training = await call('/api/training/me', undefined, session.token);
    if (typeof training.id !== 'string' || !training.id) throw new Error('Synthetic actor has no training identity.');
    actors[role] = { email, name: `QA ${role}`, token: session.token, id: training.id };
  }
  const fixture = { isolation: 'ephemeral-h2', instanceId: state.instanceId, baseURL: state.baseUrl, tag,
    actors, createdUtc: new Date().toISOString() };
  fs.writeFileSync(file, JSON.stringify(fixture, null, 2), { mode: 0o600, flag: 'wx' });
  return { run, fixture };
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try {
    const { run } = await provisionIsolatedActors(process.argv[2]);
    console.log(`Five synthetic actors ready. Set HERMES_TRAINING_QA_RUN to ${run}`);
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
