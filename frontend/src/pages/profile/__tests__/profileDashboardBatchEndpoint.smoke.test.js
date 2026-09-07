import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const pageSource = readFileSync(path.join(here, '../ProfileDashboard.jsx'), 'utf8');

assert.match(
  pageSource,
  /cachedApiJson\('\/api\/profile\/dashboard'/,
  'Profile dashboard should request the batch endpoint first through the shared resource cache.',
);

assert.match(
  pageSource,
  /cachedApiJson\('\/api\/profile\/me'\)[\s\S]*PROFILE_ACTIVITIES_FETCH_LIMIT/,
  'Profile dashboard should keep the individual endpoint fallback path with a bounded activities limit via cachedApiJson.',
);

assert.match(
  pageSource,
  /if \(dashboardData\.deferredEnrichment\)[\s\S]*loadProfileDashboardFallbackEnrichmentData\(\)/,
  'Profile dashboard should lazy-load optional batch enrichment when deferredEnrichment is true.',
);
console.log('[PASS] Profile dashboard batch endpoint guard passed.');
