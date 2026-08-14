import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const runDetailSource = readFileSync(path.join(here, 'RunDetail.jsx'), 'utf8');
const subpageNavSource = readFileSync(path.join(here, '../components/RunsSubpageNav.jsx'), 'utf8');

assert.doesNotMatch(
  runDetailSource,
  /run-detail-metrics|run_detail\.performance_metrics|performanceRows/,
  'The Performance Metrics grid should be removed from every Run Detail render path.',
);

assert.doesNotMatch(
  subpageNavSource,
  /run-detail-metrics|subnav_metrics/,
  'The Run Detail subnavigation should not keep a dead link to the removed metrics grid.',
);

console.log('[PASS] Run Detail performance metrics grid removal guard passed.');
