import assert from 'node:assert/strict';
import { buildElevationScale, buildElevationDistanceTicks } from '../raceElevationGeometry.js';

const scale = buildElevationScale([3, 54, 17, 5, 30]);
assert.ok(scale.minimum <= 3 && scale.maximum >= 54);
assert.ok(scale.ticks.length >= 3 && scale.ticks.length <= 6);
assert.equal(scale.ticks[0], scale.minimum);
assert.equal(scale.ticks.at(-1), scale.maximum);
assert.ok(scale.maximum - scale.minimum >= 20);

const flat = buildElevationScale([8, 8, 8]);
assert.ok(flat.maximum - flat.minimum >= 20, 'A flat course should not become a dramatic peak.');
assert.ok(flat.minimum <= 8 && flat.maximum >= 8);
const belowSea = buildElevationScale([-18, -12, 4]);
assert.ok(belowSea.minimum <= -18 && belowSea.maximum >= 4);

for (const distance of [0.8, 5, 10, 21.0975, 42.195, 100]) {
  const ticks = buildElevationDistanceTicks(distance);
  assert.equal(ticks[0].km, 0);
  assert.equal(ticks.at(-1).km, distance, 'The last label must represent the actual finish distance.');
  assert.ok(ticks.length >= 2 && ticks.length <= 7);
  assert.ok(ticks.every((tick, index) => !index || tick.km > ticks[index - 1].km));
  if (ticks.length > 2) {
    const interval = ticks[1].km - ticks[0].km;
    assert.ok(distance - ticks.at(-2).km >= interval / 2, 'Finish labels should have breathing room.');
  }
}
console.log('[PASS] Race elevation scale and distance labels preserve the course data.');
