import assert from 'node:assert/strict';
import { buildHeatmapViewportPointPool } from '../heatmapViewportPointPool.js';

const lattice = (activityId, visits, offset = 0) => Array.from({ length: 16 }, (_, index) => ({
  activityId, visitCount: visits,
  x: offset + 0.5 + (index % 4) * 3,
  y: 0.5 + Math.floor(index / 4) * 3,
  worldX: offset + 0.5 + (index % 4) * 3,
  worldY: 0.5 + Math.floor(index / 4) * 3,
  visualSpeedRatio: index / 16,
}));
const hot = lattice(1, 25);
const sparse = Array.from({ length: 12 }, (_, index) => ({
  activityId: 2, visitCount: 1, x: 24 + index * 12, y: 2,
  worldX: 24 + index * 12, worldY: 2, visualSpeedRatio: 0.4,
}));
const all = [...hot, ...sparse];
const result = buildHeatmapViewportPointPool(all, 20);
assert.ok(result.filter((point) => point.activityId === 1).length > 1, 'Repeat-run areas should receive more dots than a single-visit cell.');
assert.equal(result.filter((point) => point.activityId === 2).length, sparse.length, 'Sparse streets must retain coverage before density receives extra dots.');
assert.ok(result.length <= 20);
for (const point of result) {
  assert.ok(all.some((source) => source.x === point.x && source.y === point.y
    && source.worldX === point.worldX && source.worldY === point.worldY
    && source.visualSpeedRatio === point.visualSpeedRatio), 'Dots and speed values must come from actual input samples.');
}

const tight = buildHeatmapViewportPointPool(all, 15);
assert.equal(tight.length, 15);
assert.equal(tight.filter((point) => point.activityId === 2).length, 12, 'A tight budget must not spend coverage dots on the busiest cell.');

const oneRun = lattice(3, 0);
assert.ok(buildHeatmapViewportPointPool(lattice(3, 2), 100).length > buildHeatmapViewportPointPool(oneRun, 100).length,
  'Even a second distinct run should increase the visible dot density.');
assert.equal(buildHeatmapViewportPointPool(Array.from({ length: 100 }, () => oneRun).flat(), 100).length, 1,
  'Repeated recordings and stationary duplicates from one run must not inflate visit frequency.');
const separateRuns = Array.from({ length: 25 }, (_, index) => lattice(index, 0)).flat();
assert.ok(buildHeatmapViewportPointPool(separateRuns, 100).length > 1, 'Legacy samples should use distinct activity IDs, not raw point count.');

const panned = all.map((point) => ({ ...point, x: point.x - 47, y: point.y + 83 }));
assert.deepEqual(buildHeatmapViewportPointPool(panned, 20).map((point) => [point.worldX, point.worldY]),
  result.map((point) => [point.worldX, point.worldY]), 'Panning must keep cells anchored to world coordinates.');
const closeUp = oneRun.map((point) => ({ ...point, x: point.x * 8, y: point.y * 8, worldX: point.worldX * 8, worldY: point.worldY * 8 }));
assert.ok(buildHeatmapViewportPointPool(closeUp, 100).length > buildHeatmapViewportPointPool(oneRun, 100).length,
  'Zooming in must reveal more of the street geometry.');

assert.deepEqual(buildHeatmapViewportPointPool([{ x: NaN, y: 1 }, { x: 1, y: Infinity }], 20), []);
assert.deepEqual(buildHeatmapViewportPointPool(all, 0), []);
console.log('[PASS] Viewport sampling preserves GPS positions, speed colors, sparse streets, and repeat-run density.');
