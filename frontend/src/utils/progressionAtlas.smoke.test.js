import assert from 'node:assert/strict';
import {
  buildProgressionAtlas,
  getNearestProgressionPointIndex,
} from './progressionAtlas.js';

const runs = [
  {
    id: 1,
    name: 'Tempo Wednesday',
    startTime: '2026-01-05T07:15:00Z',
    distanceKm: 8,
    movingTimeSeconds: 8 * 300,
    elevationGainMeters: 60,
  },
  {
    id: 2,
    name: 'Long Sunday',
    startTime: '2026-02-16T07:15:00Z',
    distanceKm: 16,
    movingTimeSeconds: 16 * 315,
    elevationGainMeters: 140,
  },
  {
    id: 3,
    name: 'Steady Friday',
    startTime: '2026-03-20T07:15:00Z',
    distanceKm: 12,
    movingTimeSeconds: 12 * 305,
    elevationGainMeters: 90,
  },
  {
    id: 4,
    name: 'Hill Repeats Tuesday',
    startTime: '2026-03-22T07:15:00Z',
    distanceKm: 10,
    movingTimeSeconds: 10 * 320,
    totalElevationGain: 180,
  },
];

const atlas = buildProgressionAtlas(runs, 'total', 'en', new Date('2026-03-25T12:00:00Z'));

assert.equal(atlas.hasData, true);
assert.equal(atlas.chartPoints.length, 4, 'Total view should keep one point per real daily bucket when runs land on different days.');
assert.match(atlas.chartLine, /^M /, 'Chart line should be rendered as a path.');
assert.match(atlas.chartLine, / C /, 'Chart line should use cubic smoothing for multi-point series.');
assert.match(atlas.chartArea, /^M /, 'Chart area should be rendered as a closed path.');
assert.equal(atlas.latestPoint?.key, atlas.chartPoints[3]?.key);
assert.equal(
  atlas.totalElevationMeters,
  470,
  'Atlas elevation should include totalElevationGain aliases from activity payloads.',
);
assert.equal(
  getNearestProgressionPointIndex(atlas.chartPoints, atlas.chartPoints[1].x + 1.5),
  1,
  'Nearest-point lookup should resolve to the closest x-position.',
);
assert.equal(
  getNearestProgressionPointIndex(atlas.chartPoints, -50),
  0,
  'Out-of-range lookup should clamp to the first point.',
);

console.log('[PASS] Progression Atlas smoke test passed.');
