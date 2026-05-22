/**
 * Smoke test: TodayRun coach planned-distance uses the shared unit-aware formatter.
 *
 * Verifies that:
 * 1. TodayRun.jsx imports formatDistance from the shared format utility.
 * 2. formatDistance is applied to the coach planned distance with the unit context.
 * 3. The formatter produces different output for km vs mile.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { formatDistance } from './format.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const todayRunSource = readFileSync(path.join(here, '..', 'pages', 'TodayRun.jsx'), 'utf8');

// 1. TodayRun must import formatDistance from the shared util
assert.match(
  todayRunSource,
  /import \{[^}]*formatDistance[^}]*\} from ['"]\.\.\/utils\/format['"]/,
  'TodayRun.jsx should import formatDistance from ../utils/format'
);

// 2. TodayRun must use formatDistance for coachPlannedDistance
assert.match(
  todayRunSource,
  /formatDistance\(coachPayload\.today\.plannedDistanceKm/,
  'TodayRun.jsx should pass plannedDistanceKm through formatDistance'
);

// 3. Formatter output changes with unit selection
const km = formatDistance(10, 1, 'zh-CN', 'km');
const mile = formatDistance(10, 1, 'en', 'mile');

assert.match(km, /公里|km/, 'km unit label should appear for km setting');
assert.match(mile, /英里|mi/, 'mile unit label should appear for mile setting');

// numeric values differ
const kmNum = parseFloat(km);
const mileNum = parseFloat(mile);
assert.ok(
  Math.abs(kmNum - mileNum) > 1,
  `km value (${kmNum}) and mile value (${mileNum}) should differ for a 10 km distance`
);

console.log('[PASS] TodayRun coach planned-distance formatter smoke test passed.');
console.log(`  km  result: ${km}`);
console.log(`  mi  result: ${mile}`);
