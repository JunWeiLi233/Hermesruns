import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const profileSource = readFileSync(path.join(here, 'ProfileDashboard.jsx'), 'utf8');

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

console.log('[PASS] Profile load resilience smoke test passed.');
