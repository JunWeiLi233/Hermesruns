import assert from 'node:assert/strict';
import { buildHeatmapRenderPointPool } from './heatmapRenderPointPool.js';

const makePoint = (activityId, index) => ({
  activityId,
  latitude: 30 + index / 1000,
  longitude: 120 + index / 1000,
});

const points = [
  ...Array.from({ length: 100 }, (_, index) => makePoint(1001, index)),
  makePoint(2002, 100),
  makePoint(2002, 101),
];

const renderPoints = buildHeatmapRenderPointPool(points, 10);

assert.ok(renderPoints.length <= 10, 'render pool should respect the configured point budget');
assert.ok(
  renderPoints.some((point) => point.activityId === 2002),
  'render pool should retain a point from a small activity instead of dropping the activity entirely',
);

console.log('[PASS] Heatmap render pool preserves activity coverage.');
