import assert from 'node:assert/strict';
import { buildOrderedRacePredictions, predictRaceTime, predictRaceTimeCalibrated } from './vdot.js';

const now = new Date().toISOString();

const runs = [
  {
    distanceKm: 21.0975,
    movingTimeSeconds: 240 * 60,
    startTime: now,
  },
  {
    distanceKm: 42.195,
    movingTimeSeconds: 230 * 60,
    startTime: now,
  },
];

const predictions = buildOrderedRacePredictions(50, runs);
const half = predictions.find((entry) => entry.key === 'half');
const marathon = predictions.find((entry) => entry.key === 'marathon');

assert.ok(half, 'Half marathon prediction should exist.');
assert.ok(marathon, 'Marathon prediction should exist.');
assert.ok(
  half.timeMin <= marathon.timeMin,
  `Half marathon prediction must not exceed marathon prediction (half=${half.timeMin}, marathon=${marathon.timeMin}).`,
);

const staleHalfRuns = [
  {
    distanceKm: 21.0975,
    movingTimeSeconds: 180 * 60,
    startTime: new Date(Date.now() - 170 * 24 * 60 * 60 * 1000).toISOString(),
  },
];

const staleBaseHalf = predictRaceTime(55, 21097.5);
const staleCalibratedHalf = predictRaceTimeCalibrated(55, 21097.5, staleHalfRuns);

assert.ok(staleBaseHalf, 'Base half prediction should exist for stale-anchor scenario.');
assert.ok(staleCalibratedHalf, 'Calibrated half prediction should exist for stale-anchor scenario.');
assert.ok(
  staleCalibratedHalf - staleBaseHalf < 20,
  `Stale half-marathon anchor should not dominate current fitness (base=${staleBaseHalf}, calibrated=${staleCalibratedHalf}).`,
);

console.log('[PASS] vdot prediction ordering smoke test passed.');
