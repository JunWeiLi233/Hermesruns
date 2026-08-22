import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const styles = readFileSync(path.join(here, '../styles/analysis-load-balance-profile-alignment.css'), 'utf8');
const insightSource = readFileSync(path.join(here, './AnalysisInsightDetail.jsx'), 'utf8');

assert.match(
  styles,
  /\.analysis-insight-detail-page\.is-load-balance \.analysis-load-profile-chart-card \.analysis-load-command-panel-head\s*\{[\s\S]*?background:\s*transparent\s*!important;[\s\S]*?box-shadow:\s*none\s*!important;/,
  'Load-balance chart header should not render a separate panel strip behind the title and legend.',
);

assert.match(
  styles,
  /\.analysis-insight-detail-page\.is-load-balance \.analysis-load-profile-visual::after\s*\{[\s\S]*?linear-gradient\(90deg,\s*rgba\(0,\s*0,\s*0,/,
  'Load-balance hero artwork should use a black shadow overlay for readable light text.',
);

assert.doesNotMatch(
  styles,
  /\.analysis-insight-detail-page\.is-load-balance \.analysis-load-profile-visual::after\s*\{[\s\S]*?rgba\(255,\s*253,\s*249,/,
  'Load-balance hero artwork should not use the previous white wash overlay.',
);

assert.doesNotMatch(
  insightSource,
  /analysis-load-command-chart-badge|chartBadge/,
  'Load Balance should not render the static ACWR chart badge.',
);

assert.doesNotMatch(
  styles,
  /analysis-load-command-chart-badge/,
  'Load Balance should not retain styling for the removed static ACWR chart badge.',
);

console.log('[PASS] Load-balance chart panel guard passed.');
