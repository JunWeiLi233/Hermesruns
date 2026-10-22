import assert from 'node:assert/strict';
import process from 'node:process';
import { normalizeAnalysisList, buildPolarized, buildAnalysisSnapshot } from './analysisInsights.js';

const sample = [{ key: 'vo2' }];

assert.deepEqual(
  normalizeAnalysisList(sample),
  sample,
  'Analysis list normalization should preserve already-valid arrays.',
);

assert.deepEqual(
  normalizeAnalysisList(null),
  [],
  'Analysis list normalization should turn null into an empty array.',
);

assert.deepEqual(
  normalizeAnalysisList({ key: 'broken-shape' }),
  [],
  'Analysis list normalization should protect the page from non-array helper results.',
);

console.log('[PASS] Analysis snapshot list contract guard passed.');

const originalNow = Date.now;
const now = Date.parse('2026-10-11T04:30:00Z');
Date.now = () => now;
try {
  const run = (id, instant) => ({ id, name: `Fixture ${id}`, startTime: 'untrusted raw clock', activityInstant: instant,
    accountLocalDate: instant.slice(0, 10), accountTimeZone: 'America/New_York', distanceKm: 2, movingTimeSeconds: 600 });
  const current = run(1, '2026-10-11T04:05:00Z');
  const future = { ...run(2, '2026-10-12T04:00:00Z'), maxHeartRate: 250, averageHeartRate: 240 };
  const summary = buildPolarized([current, future], 40);
  assert.equal(summary.easySeconds + summary.moderateSeconds + summary.hardSeconds, 600, 'Known UTC past time must win over an untrusted raw clock; future history is excluded.');
  assert.deepEqual(buildAnalysisSnapshot([current, future], 'en', 'km'), buildAnalysisSnapshot([current], 'en', 'km'), 'Future records must not change current analysis model inputs.');
  const edge = run(3, new Date(now - 28 * 86400000).toISOString());
  const before = run(4, new Date(now - 28 * 86400000 - 1).toISOString());
  const atEdge = buildPolarized([edge, before], 40);
  assert.equal(atEdge.easySeconds + atEdge.moderateSeconds + atEdge.hardSeconds, 600, 'Elapsed lookback boundary retains only the inclusive edge.');
  const legacy = (id, date) => ({ id, name: `Legacy ${id}`, startTime: `${date}T23:59:00`, activityInstant: null,
    timeRepresentation: 'STRAVA_LOCAL_WALL_TIME', accountLocalDate: date, accountTimeZone: 'Pacific/Honolulu', distanceKm: 2, movingTimeSeconds: 600 });
  const wall = buildPolarized([legacy(5, '2026-10-10'), legacy(6, '2026-10-11'), legacy(7, '2026-09-13'), legacy(8, '2026-09-12')], 40);
  assert.equal(wall.easySeconds + wall.moderateSeconds + wall.hardSeconds, 1200, 'Unknown instants use the disclosed 28-day account-calendar fallback, not an inferred UTC instant.');
  const failures = [];
  const check = (label, test) => { try { test(); } catch (error) { failures.push(`${label}: ${error.message}`); } };
  const classifiedSeconds = summary => summary ? summary.easySeconds + summary.moderateSeconds + summary.hardSeconds : 0;
  const originalZone = process.env.TZ;
  try {
    for (const zone of ['America/New_York', 'Pacific/Honolulu', 'UTC']) {
      process.env.TZ = zone;
      check(`missing calendar metadata / ${zone}`, () => {
        const firstDay = { ...legacy(9, '2026-09-13'), accountLocalDate: undefined, startTime: '2026-09-13T00:01:00' };
        assert.equal(classifiedSeconds(buildPolarized([firstDay], 40)), 600, 'The raw legacy date must use the same account-calendar boundary in every device zone.');
      });
    }
  } finally { if (originalZone === undefined) delete process.env.TZ; else process.env.TZ = originalZone; }
  check('invalid preferred calendar metadata', () => {
    for (const invalid of ['bad-date', '2026-02-30']) {
      const malformedFuture = { ...legacy(10, '2026-10-12'), accountLocalDate: invalid };
      assert.deepEqual(buildAnalysisSnapshot([current, malformedFuture], 'en', 'km'), buildAnalysisSnapshot([current], 'en', 'km'), 'A malformed preferred calendar date must not hide a valid future wall date.');
    }
  });
  check('invalid preferred instant', () => {
    const pastHr = { ...current, movingTimeSeconds: 2400, averageHeartRate: 170, maxHeartRate: 190 };
    const malformedFuture = { ...future, activityInstant: 'bad-instant', startTime: '2026-10-12T04:00:00Z', accountLocalDate: '2026-10-10' };
    assert.deepEqual(buildPolarized([pastHr, malformedFuture], 40), buildPolarized([pastHr], 40), 'The first valid explicit-offset timestamp excludes future HR from classifying past runs.');
    assert.deepEqual(buildAnalysisSnapshot([pastHr, malformedFuture], 'en', 'km'), buildAnalysisSnapshot([pastHr], 'en', 'km'), 'Invalid preferred metadata cannot bypass snapshot future exclusion.');
  });
  assert.deepEqual(failures, [], 'Reviewed metadata fallback regressions');
} finally { Date.now = originalNow; }
console.log('[PASS] Analysis future/elapsed/legacy-window contracts passed.');
