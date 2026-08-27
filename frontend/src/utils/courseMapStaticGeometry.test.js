import assert from 'node:assert/strict';

import { buildCourseMapStaticGeometry } from './courseMapStaticGeometry.js';

const geometry = buildCourseMapStaticGeometry([
  [40, -74],
  [40.5, -73.5],
  [41, -73],
]);

assert.deepEqual(geometry.start, { x: 8, y: 86 });
assert.deepEqual(geometry.end, { x: 92, y: 14 });
assert.match(geometry.path, /^M 8\.00 86\.00/);
assert.match(geometry.path, /L 92\.00 14\.00$/);

const fallback = buildCourseMapStaticGeometry([]);
assert.deepEqual(fallback.start, { x: 8, y: 72 });
assert.deepEqual(fallback.end, { x: 92, y: 68 });

console.log('[PASS] Course-map static endpoint geometry guardrails passed.');
