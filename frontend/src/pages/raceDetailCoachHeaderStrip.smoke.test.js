import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const finalWhiteSource = readFileSync(path.join(here, '../styles/grid-cards-white.css'), 'utf8');
const resetIndex = finalWhiteSource.lastIndexOf('#root .race-detail-page .race-detail-card-head {');

assert.ok(resetIndex >= 0, 'Race detail should have a final reset for the nested coach-card heading.');
assert.match(
  finalWhiteSource.slice(resetIndex, resetIndex + 420),
  /border:\s*0 !important;[\s\S]*background:\s*transparent !important;[\s\S]*background-image:\s*none !important;[\s\S]*box-shadow:\s*none !important;[\s\S]*backdrop-filter:\s*none !important;/,
  'The race-detail coach heading should remain text-first while the outer coach card keeps its surface.',
);

console.log('[PASS] Race detail coach heading has no nested panel strip.');
