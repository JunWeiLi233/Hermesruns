import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const styleSource = readFileSync(path.join(here, '../../../styles/analysis-summary.css'), 'utf8');
const positioningBlock = styleSource.slice(styleSource.indexOf('Analysis VDOT / fitness card: mirror load-balance grid'));

assert.match(
  positioningBlock,
  /body:is\(\.theme-light,\s*\.theme-high-contrast-light\) #root \.analysis-page-shell \.analysis-profile-reference-card\.is-trend\s*\{[^}]*grid-template-areas:[\s\S]*"label gauge"[\s\S]*"copy gauge"/,
  'The fitness trend card should use the load-balance label/copy + metric grid.',
);
assert.match(
  positioningBlock,
  /\.analysis-overview-trend-stack\s*\{[^}]*grid-area:\s*gauge\s*!important;/,
  'The fitness metric stack should sit in the right-hand gauge area.',
);
assert.match(
  positioningBlock,
  /\.analysis-overview-insight-copy\s*\{[^}]*grid-area:\s*copy\s*!important;[^}]*max-width:\s*30ch\s*!important;/,
  'The fitness explanation should stay bottom-left with the same copy width as load balance.',
);

console.log('[PASS] Analysis fitness card load-balance alignment guard passed.');
