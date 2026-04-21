import assert from 'node:assert/strict';

import {
  formatStravaSyncLabel,
  markStravaAutoSyncTriggered,
  shouldTriggerStravaAutoSync,
  stravaSyncTone,
} from './stravaAutoSync.js';

function createStorage() {
  const data = new Map();
  return {
    getItem(key) {
      return data.has(key) ? data.get(key) : null;
    },
    setItem(key, value) {
      data.set(key, String(value));
    },
  };
}

const t = (key) => key;

{
  const storage = createStorage();
  assert.equal(shouldTriggerStravaAutoSync({
    isAuthenticated: true,
    authHydrated: true,
    token: 'token',
    storage,
    nowMs: 1000,
  }), true);
  markStravaAutoSyncTriggered({ storage, nowMs: 1000 });
  assert.equal(shouldTriggerStravaAutoSync({
    isAuthenticated: true,
    authHydrated: true,
    token: 'token',
    storage,
    nowMs: 1000 + (5 * 60 * 1000),
  }), false);
}

assert.equal(formatStravaSyncLabel({ linked: false }, t), 'settings.strava_not_connected');
assert.equal(formatStravaSyncLabel({ linked: true, syncStatus: { active: true } }, t), 'profile.strava_sync_processing');
assert.equal(stravaSyncTone({ linked: true, syncStatus: { status: 'FAILED', active: false } }), 'alert');
assert.equal(stravaSyncTone({ linked: true, syncStatus: { status: 'COMPLETED', active: false } }), 'live');

console.log('[PASS] Strava auto sync guardrails passed.');
