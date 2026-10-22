import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runInNewContext } from 'node:vm';

const here = path.dirname(fileURLToPath(import.meta.url));
const source = readFileSync(path.join(here, "../ProfileDashboard.jsx"), 'utf8');
const runsCacheSource = readFileSync(path.join(here, "../../runs/runsCache.ts"), 'utf8');

// Run the actual writer against quota pressure caused by sibling versioned
// Runs caches. Authentication and preferences must survive cache recovery.
const writerSource = source.match(/function writeJsonStorage\(key, value\) \{[\s\S]*?\n\}/)?.[0];
assert.ok(writerSource, 'The Profile cache writer must be available for quota recovery checks.');
const values = new Map([
  ['hermes_runs_v1_old@example.test', 'old'],
  ['hermes_runs_v2_old@example.test', 'old'],
  ['hermes_runs_v3_runner@example.test', 'current'],
  ['hermes_profile_dashboard_other@example.test', 'stale'],
  ['hermes_jwt', 'synthetic-session'],
  ['hermes_unit', 'mile'],
]);
let attempts = 0;
const warnings = [];
const localStorage = {
  get length() { return values.size; },
  key(index) { return [...values.keys()][index] ?? null; },
  removeItem(key) { values.delete(key); },
  setItem(key, value) {
    attempts += 1;
    if ([...values.keys()].some(storedKey => /^hermes_runs_v[23]_/.test(storedKey))) {
      throw Object.assign(new Error('Storage quota exceeded'), { name: 'QuotaExceededError' });
    }
    values.set(key, value);
  },
};
const writeJsonStorage = runInNewContext(`(${writerSource})`, { window: { localStorage }, console: { warn: (...args) => warnings.push(args) } });
writeJsonStorage('hermes_profile_dashboard_runner@example.test', { runs: [{ id: 1 }] });
assert.equal(attempts, 3, 'Quota recovery should retry once locally and once after sibling-cache eviction.');
assert.deepEqual(JSON.parse(values.get('hermes_profile_dashboard_runner@example.test') || 'null'), { runs: [{ id: 1 }] }, 'A slim Profile snapshot must replace quota pressure from current and previous Runs caches.');
assert.equal(values.get('hermes_jwt'), 'synthetic-session');
assert.equal(values.get('hermes_unit'), 'mile');
assert.equal(values.size, 3, 'Only the new snapshot, authentication and preference keys should remain.');
assert.deepEqual(warnings, [], 'Successful quota recovery should not report a dropped snapshot.');

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
// complete, slim v3 snapshot with both previous-version keys invalidated.
assert.match(
  source,
  /evictPrefixes = \['hermes_profile_dashboard_', 'hermes_runs_v1_', 'hermes_runs_v2_', 'hermes_runs_v3_'\]/,
  'Quota fallback should evict sibling dashboard and runs caches.',
);
assert.match(
  runsCacheSource,
  /RUNS_CACHE_KEY_PREFIX = 'hermes_runs_v3_';[\s\S]*?runs\.map\(slimRunForRunsCache\)[\s\S]*?sourceCount: runs\.length,[\s\S]*?complete: true,/,
  'Runs cache should write every slim run as a complete v3 snapshot with its source count.',
);
assert.match(
  runsCacheSource,
  /parsed\.complete !== true[\s\S]*?parsed\.runs\.length !== parsed\.sourceCount/,
  'Runs cache reads should reject incomplete or source-count-mismatched snapshots.',
);
assert.match(
  runsCacheSource,
  /RUNS_CACHE_PREVIOUS_KEY_PREFIX = 'hermes_runs_v2_';[\s\S]*?RUNS_CACHE_LEGACY_KEY_PREFIX = 'hermes_runs_v1_';[\s\S]*?for \(const prefix of \[RUNS_CACHE_KEY_PREFIX, RUNS_CACHE_PREVIOUS_KEY_PREFIX, RUNS_CACHE_LEGACY_KEY_PREFIX\]/,
  'Runs cache writes and invalidation should remove stale v1 and v2 entries.',
);
assert.match(runsCacheSource, /if \(evidence && \(!evidence\.complete \|\| evidence\.sourceCount !== runs\.length\)\) return false;/, 'A partial or count-mismatched paginated result must not replace a complete Runs snapshot.');
assert.match(
  runsCacheSource,
  /provider: run\?\.provider,/,
  'Runs cache slimming should keep the provider field cards render.',
);
