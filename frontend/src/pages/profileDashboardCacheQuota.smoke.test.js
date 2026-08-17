import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const source = readFileSync(path.join(here, './ProfileDashboard.jsx'), 'utf8');

// The profile dashboard cache must store slim run projections: full activity
// objects (route maps/telemetry) blow past the 5 MB localStorage quota and
// surfaced as QuotaExceededError on every visit for active accounts.
assert.match(
  source,
  /slimRunForCache = \(run\) => \(\{[\s\S]*?id: run\?\.id,[\s\S]*?averagePaceSecondsPerKm: run\?\.averagePaceSecondsPerKm,/,
  'Cache snapshot should project runs down to the fields the first paint reads.',
);
assert.match(
  source,
  /slice\(0, DASHBOARD_CACHE_RUN_LIMIT\)\.map\(slimRunForCache\)/,
  'Cached runs should be capped and slimmed.',
);

// Quota fallback: on failure, drop the stale key and retry once so a slim
// snapshot can replace an older fat one instead of warning forever.
assert.match(
  source,
  /window\.localStorage\.removeItem\(key\);[\s\S]*?window\.localStorage\.setItem\(key, payload\);/,
  'writeJsonStorage should clear the stale key and retry on quota errors.',
);

// Follow-up: the origin quota can be hogged by OTHER cache keys (the runs
// cache stored full uncapped activity objects). The fallback must evict the
// sibling dashboard/runs caches, and Runs.jsx must slim its own cache.
assert.match(
  source,
  /evictPrefixes = \['hermes_profile_dashboard_', 'hermes_runs_v1_'\]/,
  'Quota fallback should evict sibling dashboard and runs caches.',
);
const runsSource = readFileSync(path.join(here, './Runs.jsx'), 'utf8');
assert.match(
  runsSource,
  /RUNS_CACHE_RUN_LIMIT[\s\S]*?slice\(0, RUNS_CACHE_RUN_LIMIT\)\.map\(slimRunForRunsCache\)/,
  'Runs cache should cap and slim cached runs.',
);
assert.match(
  runsSource,
  /provider: run\?\.provider,/,
  'Runs cache slimming should keep the provider field cards render.',
);
