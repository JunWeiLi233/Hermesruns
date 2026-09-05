import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const profileSource = readFileSync(path.join(here, "../ProfileDashboard.jsx"), 'utf8');

assert.match(
  profileSource,
  /PROFILE_DASHBOARD_BATCH_TIMEOUT_MS\s*=\s*1400/,
  'Profile dashboard should timebox the batch endpoint so the loading card does not wait indefinitely.',
);

assert.match(
  profileSource,
  /withProfileDashboardTimeout\(apiJson\('\/api\/profile\/dashboard'\)\)/,
  'Profile dashboard should fall back when the batch endpoint is slow instead of blocking first paint.',
);

assert.match(
  profileSource,
  /Promise\.allSettled\(/,
  'Profile dashboard should tolerate partial API failures during the initial profile/runs/shoes bootstrap instead of failing the entire page.',
);

assert.match(
  profileSource,
  /activitiesResult\.status === 'fulfilled'/,
  'Profile dashboard should gate run hydration on the activities request result.',
);

assert.match(
  profileSource,
  /shoesResult\.status === 'fulfilled'/,
  'Profile dashboard should gate shoe hydration on the shoes request result.',
);

assert.match(
  profileSource,
  /STRAVA_SYNC_FINISHED_EVENT/,
  'Profile dashboard should react to the shared Strava sync finished event so the page can rehydrate once background import finishes.',
);

assert.match(
  profileSource,
  /consumeStravaOauthPendingFlag/,
  'Profile dashboard should consume a persisted Strava OAuth flag because AuthContext clears the redirect hash before dashboard effects run.',
);


assert.match(
  profileSource,
  /DASHBOARD_FIRST_PAINT_RUN_LIMIT\s*=\s*60/,
  'Profile dashboard should cap expensive first-paint metric calculations to a small recent run window.',
);

assert.match(
  profileSource,
  /requestIdleCallback[\s\S]*setUseFullDashboardMetrics\(true\)/,
  'Profile dashboard should expand full-history metrics after idle time instead of during first paint.',
);

assert.match(
  profileSource,
  /buildProgressionAtlas\(dashboardMetricRuns/,
  'Profile progression should use the first-paint metric slice before full metrics hydrate.',
);

assert.match(
  profileSource,
  /loadProfileDashboardFullHistoryData[\s\S]*apiJson\('\/api\/activities'\)/,
  'Profile dashboard should fetch full run history in the background after the bounded batch paints.',
);

assert.match(
  profileSource,
  /dashboardData\.source === 'batch'[\s\S]*loadProfileDashboardFullHistoryData\(\)[\s\S]*setRuns\(fullRuns\)/,
  'Profile dashboard should hydrate full runs after batch first paint without blocking the initial render.',
);
console.log('[PASS] Profile load resilience smoke test passed.');
