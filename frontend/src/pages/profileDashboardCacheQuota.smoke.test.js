import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const source = readFileSync(path.join(here, './ProfileDashboard.jsx'), 'utf8');
const runsCacheSource = readFileSync(path.join(here, './runsCache.ts'), 'utf8');

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

// Follow-up: the origin quota can be hogged by OTHER cache keys. The fallback
// must evict the sibling dashboard/runs caches, while the Runs cache keeps a
// complete, slim v2 snapshot with legacy-key invalidation.
assert.match(
  source,
  /evictPrefixes = \['hermes_profile_dashboard_', 'hermes_runs_v1_'\]/,
  'Quota fallback should evict sibling dashboard and runs caches.',
);
assert.match(
  runsCacheSource,
  /RUNS_CACHE_KEY_PREFIX = 'hermes_runs_v2_';[\s\S]*?runs\.map\(slimRunForRunsCache\)[\s\S]*?sourceCount: runs\.length,[\s\S]*?complete: true,/,
  'Runs cache should write every slim run as a complete v2 snapshot with its source count.',
);
assert.match(
  runsCacheSource,
  /parsed\.complete !== true[\s\S]*?parsed\.runs\.length !== parsed\.sourceCount/,
  'Runs cache reads should reject incomplete or source-count-mismatched snapshots.',
);
assert.match(
  runsCacheSource,
  /RUNS_CACHE_LEGACY_KEY_PREFIX = 'hermes_runs_v1_';[\s\S]*?for \(const prefix of \[RUNS_CACHE_KEY_PREFIX, RUNS_CACHE_LEGACY_KEY_PREFIX\]/,
  'Runs cache writes and invalidation should remove stale v1 entries.',
);
assert.match(
  runsCacheSource,
  /provider: run\?\.provider,/,
  'Runs cache slimming should keep the provider field cards render.',
);
