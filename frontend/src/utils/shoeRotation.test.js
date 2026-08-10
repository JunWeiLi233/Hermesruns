import assert from 'node:assert/strict';
import { buildRecentShoeSignal } from './shoeRotation.js';

const shoes = [
  {
    id: 1,
    brand: 'Saucony',
    model: 'Endorphin Speed 4',
    nickname: 'Workout',
    type: 'daily',
    currentDistanceKm: 223,
    maxDistanceKm: 650,
    isPrimary: false,
    retired: false,
  },
  {
    id: 2,
    brand: 'ASICS',
    model: 'SUPERBLAST 2',
    nickname: 'Long run',
    type: 'daily',
    currentDistanceKm: 224,
    maxDistanceKm: 750,
    isPrimary: false,
    retired: false,
  },
  {
    id: 3,
    brand: 'Nike',
    model: 'Vaporfly 3',
    nickname: 'Race day',
    type: 'daily',
    currentDistanceKm: 138,
    maxDistanceKm: 600,
    isPrimary: true,
    retired: false,
  },
];

const noEvidenceSignal = buildRecentShoeSignal(shoes, [], { preferOwnedFallback: true });

assert.equal(
  noEvidenceSignal.recommendation?.shoe?.id,
  2,
  'With no tagged-run evidence, a durable versatile trainer should outrank a primary race-day shoe.',
);

assert.equal(
  noEvidenceSignal.recommendation?.type,
  'fallback',
  'A no-evidence owned-shoe pick should be labeled as a fallback, not a primary recommendation.',
);

assert.equal(
  noEvidenceSignal.recommendation?.rationale?.role,
  'trainer',
  'The fallback should expose that it selected a general-purpose trainer.',
);

const onlyRaceShoeSignal = buildRecentShoeSignal([shoes[2]], [], { preferOwnedFallback: true });

assert.equal(
  onlyRaceShoeSignal.recommendation?.shoe?.id,
  3,
  'The fallback should still return an active race shoe when it is the only owned option.',
);

const originalDateNow = Date.now;
Date.now = () => Date.parse('2026-08-09T12:00:00Z');

const recentRuns = [
  { id: 101, shoeId: 3, distanceKm: 8, movingTimeSeconds: 2400, startDate: '2026-08-08T12:00:00Z' },
  { id: 102, shoeId: 3, distanceKm: 7, movingTimeSeconds: 2100, startDate: '2026-08-06T12:00:00Z' },
  { id: 103, shoeId: 3, distanceKm: 6, movingTimeSeconds: 1800, startDate: '2026-08-04T12:00:00Z' },
  { id: 104, shoeId: 2, distanceKm: 14, movingTimeSeconds: 4480, startDate: '2026-08-07T12:00:00Z' },
  { id: 105, shoeId: 2, distanceKm: 12, movingTimeSeconds: 3840, startDate: '2026-08-05T12:00:00Z' },
];

const recentUsageSignal = buildRecentShoeSignal(shoes, recentRuns, { preferOwnedFallback: true });
Date.now = originalDateNow;

assert.equal(
  recentUsageSignal.recommendation?.shoe?.id,
  2,
  'A versatile trainer should remain the general recommendation when a race shoe only has a small usage-count advantage.',
);

Date.now = () => Date.parse('2026-08-09T12:00:00Z');
const verifiedPerformanceSignal = buildRecentShoeSignal(shoes, [
  { id: 201, shoeId: 3, distanceKm: 8, movingTimeSeconds: 2400, averageHeartRate: 145, startDate: '2026-08-08T12:00:00Z' },
  { id: 202, shoeId: 3, distanceKm: 7, movingTimeSeconds: 2100, averageHeartRate: 146, startDate: '2026-08-06T12:00:00Z' },
  { id: 203, shoeId: 3, distanceKm: 6, movingTimeSeconds: 1800, averageHeartRate: 144, startDate: '2026-08-04T12:00:00Z' },
  { id: 204, shoeId: 2, distanceKm: 10, movingTimeSeconds: 3000, averageHeartRate: 153, startDate: '2026-08-07T12:00:00Z' },
  { id: 205, shoeId: 2, distanceKm: 9, movingTimeSeconds: 2700, averageHeartRate: 152, startDate: '2026-08-05T12:00:00Z' },
], { preferOwnedFallback: true });
Date.now = originalDateNow;

assert.equal(
  verifiedPerformanceSignal.recommendation?.shoe?.id,
  3,
  'Strong same-pace heart-rate evidence should outrank the general-purpose fallback score.',
);

assert.equal(
  verifiedPerformanceSignal.recommendation?.type,
  'insight',
  'A performance-backed recommendation should remain clearly distinguished from a fallback.',
);

Date.now = () => Date.parse('2026-08-09T12:00:00Z');
const mixedPerformanceSignal = buildRecentShoeSignal(shoes, [
  ...[1, 2, 3].map((day, index) => ({
    id: 300 + index,
    shoeId: 1,
    distanceKm: 8,
    movingTimeSeconds: 2400,
    averageHeartRate: 145,
    startDate: `2026-08-0${day}T12:00:00Z`,
  })),
  ...[4, 5, 6].map((day, index) => ({
    id: 310 + index,
    shoeId: 2,
    distanceKm: 8,
    movingTimeSeconds: 2400,
    averageHeartRate: 146,
    startDate: `2026-08-0${day}T12:00:00Z`,
  })),
  ...[7, 8, 9].map((day, index) => ({
    id: 320 + index,
    shoeId: 3,
    distanceKm: 8,
    movingTimeSeconds: 2400,
    averageHeartRate: 170,
    startDate: `2026-08-0${day}T12:00:00Z`,
  })),
], { preferOwnedFallback: true });
Date.now = originalDateNow;

assert.equal(
  mixedPerformanceSignal.recommendation?.shoe?.id,
  1,
  'A valid positive performance signal should not be hidden by a larger negative correlation on another shoe.',
);

assert.equal(
  mixedPerformanceSignal.recommendation?.type,
  'insight',
  'Mixed positive and negative correlations should still produce the strongest positive evidence-backed pick.',
);

console.log('[PASS] Shoe rotation recommendation quality guard passed.');
