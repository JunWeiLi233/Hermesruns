import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(join(here, "../AnalysisInsightDetail.jsx"), 'utf8');
const styles = readFileSync(join(here, "../../../styles/_split/analysis.css"), 'utf8');
const alignmentStyles = readFileSync(join(here, "../../../styles/analysis-profile-visual-alignment.css"), 'utf8');
const routeBlock = styles.match(
  /\.analysis-insight-detail-page\.is-coach-insight \.analysis-coach-command-reason-list \{[\s\S]*?\n\}/,
)?.[0];

assert.ok(routeBlock, 'Coach Insight should have a route-scoped reason-list style block.');
assert.match(routeBlock, /gap:\s*8px;/, 'Coach Insight reason grids should have visible space between rows.');
assert.match(routeBlock, /padding:\s*8px;/, 'Coach Insight reason grids should have padding around the list.');
assert.match(
  source,
  /className="analysis-coach-command-support-card analysis-coach-command-support-card--reasons"/,
  'Coach Insight reasons should have a dedicated surface hook.',
);
assert.match(
  alignmentStyles,
  /body #root \.analysis-insight-detail-page\.is-coach-insight \.analysis-profile-v2--coach \.analysis-coach-command-support-card--reasons\s*\{[\s\S]*?background:\s*var\(--analysis-v2-card\) !important;[\s\S]*?box-shadow:\s*none !important;/,
  'Coach Insight reasons should retain the surrounding card surface.',
);
assert.match(
  alignmentStyles,
  /body #root \.analysis-insight-detail-page\.is-coach-insight \.analysis-profile-v2--coach \.analysis-coach-command-support-card--reasons \.analysis-coach-command-panel-head\s*\{[\s\S]*?background:\s*transparent !important;[\s\S]*?border:\s*0 !important;[\s\S]*?box-shadow:\s*none !important;/,
  'Coach Insight reasons should remove only the title panel strip.',
);

console.log('[PASS] Coach Insight reason grids have padded spacing.');
