/**
 * Smoke test: computeVdotTrend returns correct direction and hasData flag.
 *
 * Verifies:
 * 1. hasData: false when no runs provided
 * 2. hasData: false when one window is empty (all runs older than 60 days)
 * 3. direction: 'improving' when recent VDOT is clearly higher (delta > 0.8)
 * 4. direction: 'declining' when recent VDOT is clearly lower (delta < -0.8)
 * 5. direction: 'maintaining' when delta is within ±0.8
 */
import assert from 'node:assert/strict';
import { computeVdotTrend } from './vdot.js';

const DAY_MS = 24 * 60 * 60 * 1000;
const now = Date.now();

/**
 * Build a minimal run object that produces a VDOT estimate via the race formula.
 * distanceKm and movingTimeSeconds drive the pace; no HR so the race path is used.
 * To pass the NO_HR_MAX_PACE_SLOP_FACTOR gate we keep all runs at similar pace so
 * the median pace check is satisfied.
 *
 * @param {number} daysAgo  - how old the run is
 * @param {number} distKm   - distance in km (>= 3 to use strict pool)
 * @param {number} timeSec  - moving time in seconds
 */
function makeRun(daysAgo, distKm, timeSec) {
  const startTime = new Date(now - daysAgo * DAY_MS).toISOString();
  return {
    distanceKm: distKm,
    movingTimeSeconds: timeSec,
    startTime,
  };
}

// ---------------------------------------------------------------------------
// Test 1: hasData: false — no runs
// ---------------------------------------------------------------------------
{
  const result = computeVdotTrend([], now);
  assert.strictEqual(result.hasData, false, 'Test 1: empty runs → hasData should be false');
  assert.strictEqual(result.direction, 'maintaining', 'Test 1: empty runs → direction should be maintaining');
}

// ---------------------------------------------------------------------------
// Test 2: hasData: false — all runs are older than 60 days (neither window filled)
// ---------------------------------------------------------------------------
{
  // Runs from 70-90 days ago fall outside both the 0-30 and 30-60 day windows.
  const oldRuns = [
    makeRun(70, 10, 3000),
    makeRun(80, 10, 3000),
    makeRun(90, 10, 3000),
  ];
  const result = computeVdotTrend(oldRuns, now);
  assert.strictEqual(result.hasData, false, 'Test 2: all runs > 60 days old → hasData should be false');
}

// ---------------------------------------------------------------------------
// Test 3: direction 'improving' — recent window has clearly faster pace
//
// Prior window (35-55 days ago): 10 km in 3600 s (~6:00/km, lower VDOT)
// Recent window (5-20 days ago): 10 km in 2700 s (~4:30/km, higher VDOT)
// Delta is expected to be well above 0.8.
// ---------------------------------------------------------------------------
{
  const runs = [
    // prior: 6:00/km pace
    makeRun(55, 10, 3600),
    makeRun(45, 10, 3600),
    makeRun(35, 10, 3600),
    // recent: 4:30/km pace — clearly faster
    makeRun(20, 10, 2700),
    makeRun(10, 10, 2700),
    makeRun(5, 10, 2700),
  ];
  const result = computeVdotTrend(runs, now);
  assert.strictEqual(result.hasData, true, 'Test 3: both windows populated → hasData should be true');
  assert.strictEqual(result.direction, 'improving', `Test 3: faster recent pace → direction should be 'improving' (delta=${result.delta})`);
  assert.ok(result.delta > 0.8, `Test 3: delta should be > 0.8, got ${result.delta}`);
}

// ---------------------------------------------------------------------------
// Test 4: direction 'declining' — recent window has clearly slower pace
//
// Prior window (35-55 days ago): 10 km in 2700 s (~4:30/km, higher VDOT)
// Recent window (5-20 days ago): 10 km in 3600 s (~6:00/km, lower VDOT)
// Delta is expected to be well below -0.8.
// ---------------------------------------------------------------------------
{
  const runs = [
    // prior: 4:30/km pace
    makeRun(55, 10, 2700),
    makeRun(45, 10, 2700),
    makeRun(35, 10, 2700),
    // recent: 6:00/km pace — clearly slower
    makeRun(20, 10, 3600),
    makeRun(10, 10, 3600),
    makeRun(5, 10, 3600),
  ];
  const result = computeVdotTrend(runs, now);
  assert.strictEqual(result.hasData, true, 'Test 4: both windows populated → hasData should be true');
  assert.strictEqual(result.direction, 'declining', `Test 4: slower recent pace → direction should be 'declining' (delta=${result.delta})`);
  assert.ok(result.delta < -0.8, `Test 4: delta should be < -0.8, got ${result.delta}`);
}

// ---------------------------------------------------------------------------
// Test 5: direction 'maintaining' — both windows have the same pace
//
// Identical pace across both windows → delta near 0, well within ±0.8.
// ---------------------------------------------------------------------------
{
  const runs = [
    // prior: same pace
    makeRun(55, 10, 3000),
    makeRun(45, 10, 3000),
    makeRun(35, 10, 3000),
    // recent: same pace
    makeRun(20, 10, 3000),
    makeRun(10, 10, 3000),
    makeRun(5, 10, 3000),
  ];
  const result = computeVdotTrend(runs, now);
  assert.strictEqual(result.hasData, true, 'Test 5: both windows populated → hasData should be true');
  assert.strictEqual(result.direction, 'maintaining', `Test 5: identical pace → direction should be 'maintaining' (delta=${result.delta})`);
  assert.ok(Math.abs(result.delta) <= 0.8, `Test 5: |delta| should be <= 0.8, got ${result.delta}`);
}

console.log('[PASS] computeVdotTrend smoke test — all 5 cases passed.');
