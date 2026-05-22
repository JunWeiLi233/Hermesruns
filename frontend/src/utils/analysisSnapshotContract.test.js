import assert from 'node:assert/strict';
import { normalizeAnalysisList } from './analysisInsights.js';

const sample = [{ key: 'vo2' }];

assert.deepEqual(
  normalizeAnalysisList(sample),
  sample,
  'Analysis list normalization should preserve already-valid arrays.',
);

assert.deepEqual(
  normalizeAnalysisList(null),
  [],
  'Analysis list normalization should turn null into an empty array.',
);

assert.deepEqual(
  normalizeAnalysisList({ key: 'broken-shape' }),
  [],
  'Analysis list normalization should protect the page from non-array helper results.',
);

console.log('[PASS] Analysis snapshot list contract guard passed.');
