import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const pageSource = readFileSync(path.join(here, '../Analysis.jsx'), 'utf8');
const tableStart = pageSource.indexOf('{trainingZones.map((zone) => (');
const tableEnd = pageSource.indexOf('</tbody>', tableStart);
const trainingZoneRows = pageSource.slice(tableStart, tableEnd);

assert.ok(tableStart >= 0 && tableEnd > tableStart, 'The training-zone table rows should remain present.');
assert.match(
  trainingZoneRows,
  /<td>\s*\{t\(`analysis\.stitch_zone_\$\{zone\.key\}`\)\}\s*<\/td>/,
  'Training-zone labels such as 轻松跑 should render as normal table text.',
);
assert.doesNotMatch(
  trainingZoneRows,
  /<td>\s*<strong>\{t\(`analysis\.stitch_zone_\$\{zone\.key\}`\)\}<\/strong>\s*<\/td>/,
  'Training-zone labels should not be wrapped in a bold strong element.',
);

console.log('[PASS] Analysis training-zone label weight guard passed.');
