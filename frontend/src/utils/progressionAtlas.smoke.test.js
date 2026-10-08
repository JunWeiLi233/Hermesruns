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
assert.match(atlas.chartLine, / L /, 'Straight segments must preserve the measured rate of change.');
assert.doesNotMatch(atlas.chartLine, / C /, 'Smoothing must not invent slopes or dips between observations.');
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

const localRun = (day, distanceKm) => ({ startTime: new Date(2026, 0, day, 9).toISOString(), distanceKm });
const sparse = buildProgressionAtlas([localRun(2, 10), localRun(12, 20)], 'month', 'en', new Date(2026, 0, 20, 12));
assert.equal(sparse.chartSeries[0].cumulativeDistance, 0, 'The visible window must begin at zero.');
assert.equal(sparse.chartSeries.at(-1).x, 400, 'The series must extend through the end of the window.');
assert.equal(sparse.chartSeries.at(-1).cumulativeDistance, 30);
const idleDays = sparse.chartSeries.filter((point) => point.date.getDate() >= 3 && point.date.getDate() <= 11);
assert.equal(idleDays.length, 9, 'Non-running days must remain on the calendar axis.');
assert.ok(idleDays.every((point) => point.cumulativeDistance === 10), 'A break must remain flat until the next run day.');
assert.ok(sparse.chartSeries.every((point, index, series) => index === 0 || point.y <= series[index - 1].y), 'Cumulative distance must never dip.');
assert.equal(sparse.yTicks.at(-1).valueKm, 0, 'The distance axis must start at zero.');
assert.ok(sparse.yTicks[0].valueKm >= 30);
const xSpans = sparse.xTicks.slice(1).map((tick, index) => tick.x - sparse.xTicks[index].x);
assert.ok(xSpans.every((span) => Math.abs(span - xSpans[0]) < 0.000001), 'Date ticks must use a linear time scale.');
assert.equal(sparse.weeklyBars.reduce((sum, bar) => sum + bar.distanceKm, 0), 30, 'Weekly volumes must reconcile with the cumulative total.');
assert.ok(sparse.weeklyBars.some((bar) => bar.distanceKm === 0), 'Weeks without runs must remain visible.');

const singleton = buildProgressionAtlas([localRun(8, 5)], 'month', 'en', new Date(2026, 0, 20, 12));
assert.ok(singleton.chartPoints[0].x > 0 && singleton.chartPoints[0].x < 200, 'A single activity must stay at its real date rather than the chart end.');
assert.equal(singleton.chartSeries.at(-1).cumulativeDistance, 5, 'The tail after one run must stay flat.');

const sameDay = buildProgressionAtlas([localRun(8, 5), localRun(8, 7)], 'month', 'en', new Date(2026, 0, 20, 12));
assert.equal(sameDay.chartPoints.length, 1);
assert.equal(sameDay.chartPoints[0].cumulativeDistance, 12, 'Multiple runs on a day must add up exactly once.');
const empty = buildProgressionAtlas([], '1m', 'en', new Date(2026, 0, 20, 12));
assert.equal(empty.chartLine, '', 'An empty history must never draw a sample trend.');
assert.equal(empty.chartArea, '');
const zeroDistance = buildProgressionAtlas([localRun(8, 0)], 'month', 'en', new Date(2026, 0, 20, 12));
assert.ok(zeroDistance.chartSeries.every((point) => Number.isFinite(point.y) && point.cumulativeDistance === 0));

console.log('[PASS] Progression Atlas smoke test passed.');
