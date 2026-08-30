import assert from 'node:assert/strict';

import {
  clearStravaOauthPendingFlag,
  consumeStravaOauthPendingFlag,
  formatStravaSyncLabel,
  markStravaAutoSyncTriggered,
  markStravaOauthPendingFlag,
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
    removeItem(key) {
      data.delete(key);
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

{
  const localStorageLog = [];
  const localStorageBase = createStorage();
  const sessionStorageLog = [];
  const sessionStorageBase = createStorage();
  const trackCalls = (log, base) => ({
    getItem(key) {
      log.push(`getItem:${key}`);
      return base.getItem(key);
    },
    setItem(key, value) {
      log.push(`setItem:${key}`);
      base.setItem(key, value);
    },
    removeItem(key) {
      log.push(`removeItem:${key}`);
      base.removeItem(key);
    },
  });
  const previousWindow = globalThis.window;
  globalThis.window = {
    localStorage: trackCalls(localStorageLog, localStorageBase),
    sessionStorage: trackCalls(sessionStorageLog, sessionStorageBase),
  };
  try {
    assert.equal(shouldTriggerStravaAutoSync({
      isAuthenticated: true,
      authHydrated: true,
      token: 'token',
      nowMs: 1000,
    }), true);
    markStravaAutoSyncTriggered({ nowMs: 1000 });
    assert.equal(shouldTriggerStravaAutoSync({
      isAuthenticated: true,
      authHydrated: true,
      token: 'token',
      nowMs: 1000 + (5 * 60 * 1000),
    }), false);
    assert.deepEqual(localStorageLog, [
      'getItem:hermes_strava_auto_sync_at',
      'setItem:hermes_strava_auto_sync_at',
      'getItem:hermes_strava_auto_sync_at',
    ]);
    assert.equal(localStorageBase.getItem('hermes_strava_auto_sync_at'), '1000');
    assert.deepEqual(sessionStorageLog, []);
  } finally {
    if (previousWindow === undefined) {
      delete globalThis.window;
    } else {
      globalThis.window = previousWindow;
    }
  }
}

{
  const storage = createStorage();
  markStravaOauthPendingFlag({ storage, nowMs: 1000 });
  assert.equal(consumeStravaOauthPendingFlag({ storage, nowMs: 2000 }), true);
  assert.equal(consumeStravaOauthPendingFlag({ storage, nowMs: 2001 }), false);
}

{
  const storage = createStorage();
  markStravaOauthPendingFlag({ storage, nowMs: 1000 });
  clearStravaOauthPendingFlag({ storage });
  assert.equal(consumeStravaOauthPendingFlag({ storage, nowMs: 2000 }), false);
}

assert.equal(formatStravaSyncLabel({ linked: false }, t), 'settings.strava_not_connected');
assert.equal(formatStravaSyncLabel({ linked: true, syncStatus: { active: true } }, t), 'profile.strava_sync_processing');
assert.equal(formatStravaSyncLabel({ linked: true, syncStatus: { status: 'FAILED', active: false, error: 'Strava application is inactive.' } }, t), 'settings.stitch_strava_active');
assert.equal(stravaSyncTone({ linked: true, syncStatus: { status: 'FAILED', active: false } }), 'alert');
assert.equal(stravaSyncTone({ linked: true, syncStatus: { status: 'COMPLETED', active: false } }), 'live');

console.log('[PASS] Strava auto sync guardrails passed.');
