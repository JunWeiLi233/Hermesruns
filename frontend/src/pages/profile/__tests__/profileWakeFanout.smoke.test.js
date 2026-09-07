import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../../..');

const profile = readFileSync(path.join(here, '../ProfileDashboard.jsx'), 'utf8');
const runs = readFileSync(path.join(root, 'pages/runs/Runs.jsx'), 'utf8');
const chrome = readFileSync(path.join(root, 'components/AuthenticatedPageChrome.jsx'), 'utf8');
const resourceCache = readFileSync(path.join(root, 'api/resourceCache.ts'), 'utf8');
const analysis = readFileSync(path.join(root, 'pages/analysis/Analysis.jsx'), 'utf8');

// Measured first-paint fan-out (happy path, auth already hydrated):
// Profile: 1x /api/profile/dashboard (+ idle weekly-digest + optional full-history)
// Analysis: profile/me + activities/analysis + coach/today + injury-risk/status = 4
// Runs: activities + profile/me + strava/status + route-previews batch = 4
// Cross-page remount within TTL must reuse cachedApiJson for profile/me + activities*.

assert.match(
  resourceCache,
  /\['\/api\/profile\/dashboard', PROFILE_TTL_MS\]/,
  'resourceCache must TTL-cache the profile dashboard batch to collapse remount stampedes.',
);

assert.match(
  profile,
  /PROFILE_DASHBOARD_BATCH_TIMEOUT_MS\s*=\s*8000/,
  'Batch timeout must cover wake retries (1s+2.5s) before falling back.',
);

assert.match(
  profile,
  /controller\.abort\(\)[\s\S]*cachedApiJson\('\/api\/profile\/dashboard'/,
  'Timed-out batch must abort before fallback fan-out.',
);

assert.match(
  runs,
  /cachedApiJson\('\/api\/activities'\)/,
  'Runs first paint must go through cachedApiJson for /api/activities.',
);

assert.match(
  runs,
  /cachedApiJson\('\/api\/profile\/me'\)/,
  'Runs first paint must go through cachedApiJson for /api/profile/me.',
);

assert.match(
  chrome,
  /cachedApiJson\('\/api\/profile\/me'\)/,
  'Authenticated shell chrome must reuse cached profile/me instead of a raw duplicate fetch.',
);

assert.match(
  analysis,
  /cachedApiJson\('\/api\/profile\/me'\)/,
  'Analysis must keep cachedApiJson for profile/me.',
);

assert.match(
  analysis,
  /cachedApiJson\('\/api\/activities\/analysis'\)/,
  'Analysis must keep cachedApiJson for activities/analysis.',
);

assert.equal(
  (runs.match(/apiJson\('\/api\/activities'\)/g) || []).length,
  0,
  'Runs must not raw-apiJson /api/activities on mount (duplicates Analysis/Profile cache).',
);


assert.match(
  analysis,
  /requestIdleCallback[\s\S]*loadCoachToday\(\)/,
  'Analysis coach/today must remain idle-deferred after #115 cachedApiJson wiring.',
);

console.log('[PASS] Profile/Runs/Analysis wake fan-out smoke test passed.');

