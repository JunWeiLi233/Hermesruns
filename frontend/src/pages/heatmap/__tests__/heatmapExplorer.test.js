import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildExplorerTiles, filterExplorerActivities, summarizeExplorerActivities, explorerCsv, splitRouteAtGaps } from '../heatmapExplorerModel.js';

test('filters intersect dates, name, source, distance and moving time without inventing missing metrics', () => {
  const runs = [
    { id: 1, name: 'Park, sunrise', provider: 'GARMIN', startTime: '2026-10-01T08:00:00', distanceKm: 10, movingTimeSeconds: 3300 },
    { id: 2, name: 'Park', provider: 'STRAVA', startTime: '2026-09-30T08:00:00', distanceKm: 5, movingTimeSeconds: 1800 },
    { id: 3, name: 'Park', provider: 'GARMIN', startTime: '2026-10-01T08:00:00' },
  ];
  assert.deepEqual(filterExplorerActivities(runs, { query: 'PARK', from: '2026-10-01', to: '2026-10-01', provider: 'GARMIN', minDistance: '6', maxDistance: '12', minMinutes: '30' }).map(x => x.id), [1]);
  assert.equal(filterExplorerActivities(runs, {}).length, 3);
  assert.deepEqual(filterExplorerActivities(runs, { minDistance: '12', maxDistance: '6' }), []);
});

test('date filters use account calendar dates and include the final day', () => {
  assert.equal(filterExplorerActivities([{ id: 1, activityInstant: '2026-10-02T01:30:00Z' }], { to: '2026-10-01' }, 'America/New_York').length, 1);
});

test('sparse explorer grid counts unique tiles, four-neighbour clusters and the largest filled square', () => {
  const n = 2 ** 14;
  const point = (x, y) => ({ latitude: Math.atan(Math.sinh(Math.PI * (1 - 2 * (y + 0.5) / n))) * 180 / Math.PI, longitude: (x + 0.5) / n * 360 - 180 });
  const points = [];
  for (let y = 8000; y < 8003; y++) for (let x = 8000; x < 8003; x++) points.push(point(x, y));
  const grid = buildExplorerTiles([...points, points[0], { latitude: NaN, longitude: 0 }, { latitude: 0, longitude: 0 }]);
  assert.equal(grid.tiles.length, 9);
  assert.equal(grid.clusterKeys.size, 1);
  assert.equal(grid.maxCluster, 1);
  assert.equal(grid.maxSquare.size, 3);
  assert.equal(buildExplorerTiles([]).maxSquare.size, 0);
});

test('summaries preserve unavailable metrics and CSV neutralizes spreadsheet formulas', () => {
  assert.deepEqual(summarizeExplorerActivities([{ distanceKm: 5, movingTimeSeconds: 1800 }, {}]), { count: 2, distanceKm: 5, movingSeconds: 1800, distanceCount: 1, durationCount: 1 });
  const csv = explorerCsv([{ id: 1, name: '=HYPERLINK("bad")', distanceKm: 5 }, { id: 2, name: 'Park, sunrise' }]);
  assert.match(csv, /'=/);
  assert.match(csv, /"Park, sunrise"/);
  assert.doesNotMatch(csv, /undefined|null/);
});

test('route drawing breaks across invalid GPS and long gaps instead of drawing travel connectors', () => {
  const route = splitRouteAtGaps([{ latitude: 40, longitude: -74 }, { latitude: 40.001, longitude: -74 }, { latitude: 41, longitude: -74 }, { latitude: 41.001, longitude: -74 }]);
  assert.deepEqual(route.map(x => x.length), [2, 2]);
});
