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

const weatherAffectedRuns = [
  {
    distanceKm: 10,
    movingTimeSeconds: 60 * 60,
    weatherAdjustedMovingTimeSeconds: 56 * 60,
    pacePenaltySecPerKm: 24,
    weatherAdjusted: true,
    startTime: now,
  },
];

const rawWeatherAnchorPrediction = predictRaceTimeCalibrated(50, 10000, weatherAffectedRuns);
const adjustedWeatherAnchorPrediction = predictRaceTimeCalibrated(50, 10000, weatherAffectedRuns, {
  weatherAdjustedAnchors: true,
});

assert.ok(rawWeatherAnchorPrediction, 'Raw weather-affected prediction should exist.');
assert.ok(adjustedWeatherAnchorPrediction, 'Weather-adjusted prediction should exist.');
assert.ok(
  adjustedWeatherAnchorPrediction < rawWeatherAnchorPrediction,
  `Weather-adjusted calibration should recover time lost to conditions (raw=${rawWeatherAnchorPrediction}, adjusted=${adjustedWeatherAnchorPrediction}).`,
);

console.log('[PASS] vdot prediction ordering smoke test passed.');
