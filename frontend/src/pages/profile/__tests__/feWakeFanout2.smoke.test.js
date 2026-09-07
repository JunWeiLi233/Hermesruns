import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../../..');

const analysis = readFileSync(path.join(root, 'pages/analysis/Analysis.jsx'), 'utf8');
const runs = readFileSync(path.join(root, 'pages/runs/Runs.jsx'), 'utf8');
const runDetail = readFileSync(path.join(root, 'pages/runs/RunDetail.jsx'), 'utf8');
const chrome = readFileSync(path.join(root, 'components/AuthenticatedPageChrome.jsx'), 'utf8');
const insight = readFileSync(path.join(root, 'pages/analysis/AnalysisInsightDetail.jsx'), 'utf8');
const schedule = readFileSync(path.join(root, 'pages/schedule/Schedule.jsx'), 'utf8');
const todayRun = readFileSync(path.join(root, 'pages/today-run/TodayRun.jsx'), 'utf8');
const pageVisibility = readFileSync(path.join(root, 'utils/pageVisibility.js'), 'utf8');

// Analysis first-paint: only profile + activities; coach + injury idle-deferred.
assert.match(
  analysis,
  /loadProfile\(\);\s*loadRuns\(\);[\s\S]*requestIdleCallback[\s\S]*loadCoachToday\(\)/,
  'Analysis must idle-defer coach/today after critical profile+activities first paint.',
);
assert.doesNotMatch(
  analysis,
  /loadProfile\(\);\s*loadRuns\(\);\s*loadCoachToday\(\);/,
  'Analysis must not keep coach/today on the parallel mount critical path.',
);
assert.match(
  analysis,
  /requestIdleCallback[\s\S]*apiJson\('\/api\/injury-risk\/status'\)/,
  'Analysis must idle-defer injury-risk/status off first paint.',
);

// Runs: route-previews after list paint; no eager preload in loadRuns.
assert.doesNotMatch(
  runs,
  /requestRoutePreviews\(preloadIds/,
  'Runs must not request route-previews inside loadRuns before the list paints.',
);
assert.match(
  runs,
  /requestIdleCallback[\s\S]*requestRoutePreviews\(pendingIds/,
  'Runs route-previews must schedule after idle/paint.',
);

// Backgrounded tab must not keep waking sync-status.
assert.match(
  pageVisibility,
  /export function waitWhileDocumentHidden/,
  'Shared visibility helper must exist for poll loops.',
);
assert.match(
  runs,
  /await waitWhileDocumentHidden\(\);[\s\S]*\/api\/auth\/strava\/sync-status/,
  'Runs Strava sync poll must pause while the document is hidden.',
);
assert.match(
  runDetail,
  /await waitWhileDocumentHidden\(\);[\s\S]*\/api\/auth\/strava\/sync-status/,
  'RunDetail Strava sync poll must pause while the document is hidden.',
);

// Chrome stays on cached profile (no new polling).
assert.match(
  chrome,
  /cachedApiJson\('\/api\/profile\/me'\)/,
  'AuthenticatedPageChrome must keep cached profile/me (no duplicate raw fetch).',
);

// Cross-page remounts reuse cached profile/activities.
assert.match(insight, /cachedApiJson\('\/api\/profile\/me'\)/);
assert.match(insight, /cachedApiJson\('\/api\/activities'\)/);
assert.match(schedule, /cachedApiJson\('\/api\/profile\/me'\)/);
assert.match(schedule, /cachedApiJson\('\/api\/activities'\)/);
assert.match(todayRun, /cachedApiJson\('\/api\/profile\/me'\)/);
assert.match(todayRun, /cachedApiJson\('\/api\/activities'\)/);

console.log('[PASS] FE wake fan-out round-2 smoke test passed.');
