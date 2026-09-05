import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const styleSource = readFileSync(path.join(here, '../../../styles/_split/analysis.css'), 'utf8');
const finalStyleSource = readFileSync(path.join(here, '../../../styles/analysis-summary.css'), 'utf8');
const separationBlock = styleSource.slice(styleSource.indexOf('Analysis independent bento card surfaces'));

assert.match(
  separationBlock,
  /body:is\(\.theme-light,\s*\.theme-high-contrast-light\) #root \.analysis-page-shell \.analysis-profile-bento-grid\s*\{[^}]*border:\s*0\s*!important;[^}]*border-radius:\s*0\s*!important;[^}]*background:\s*transparent\s*!important;[^}]*box-shadow:\s*none\s*!important;/,
  'Analysis summary bento grid should not render an outer card surface.',
);

assert.match(
  separationBlock,
  /body:is\(\.theme-light,\s*\.theme-high-contrast-light\) #root \.analysis-page-shell \.analysis-profile-bento-grid\s*>\s*\.analysis-profile-bento-card\s*\{[^}]*border:\s*1px\s+solid\s+rgba\(60,\s*60,\s*67,\s*0\.18\)\s*!important;[^}]*border-radius:\s*12px\s*!important;[^}]*background:\s*#fff\s*!important;/,
  'Each Analysis summary bento card should keep its own independent card surface.',
);

assert.match(
  finalStyleSource,
  /body:is\(\.theme-light,\s*\.theme-high-contrast-light\) #root \.analysis-page-shell \.analysis-profile-bento-grid\s*\{[^}]*border:\s*0\s*!important;[^}]*border-radius:\s*0\s*!important;[^}]*padding:\s*0\s*!important;[^}]*background:\s*transparent\s*!important;[^}]*box-shadow:\s*none\s*!important;/,
  'The final Analysis stylesheet should clear the outer bento surface after shared card rules.',
);

assert.match(
  finalStyleSource,
  /body:is\(\.theme-light,\s*\.theme-high-contrast-light\) #root \.analysis-page-shell \.analysis-profile-bento-grid\s*>\s*\.analysis-profile-bento-card\s*\{[^}]*border:\s*0\s*!important;[^}]*border-radius:\s*var\(--ahs-radius-lg\)\s*!important;[^}]*background:\s*var\(--ahs-surface\)\s*!important;[^}]*box-shadow:\s*var\(--ahs-shadow\)\s*!important;/,
  'Analysis summary cards should use the same borderless surface treatment as the load-balance card.',
);

assert.match(
  finalStyleSource,
  /#root \.analysis-page-shell \.analysis-profile-reference-card\.is-coach\s*\{[^}]*border:\s*0\s*!important;[^}]*border-width:\s*0\s*!important;[^}]*border-style:\s*none\s*!important;[^}]*border-color:\s*transparent\s*!important;[^}]*box-shadow:\s*none\s*!important;[^}]*outline:\s*none\s*!important;/,
  'Coach Insight should not render a light grey border or shadow.',
);

assert.match(
  finalStyleSource,
  /#root \.analysis-page-shell \.analysis-profile-reference-card\.is-load \.analysis-overview-card-kicker--load\s*\{[^}]*align-self:\s*start\s*!important;[^}]*margin:\s*0\s*!important;/,
  'Workload title should align with the adjacent trend title.',
);

assert.match(
  finalStyleSource,
  /#root \.analysis-page-shell \.analysis-overview-vdot-trend-heading \.runner-dashboard-side-link-icon\s*\{[^}]*background:\s*transparent\s*!important;[^}]*background-image:\s*none\s*!important;[^}]*border:\s*0\s*!important;[^}]*box-shadow:\s*none\s*!important;/,
  'Trend icon should render without a background tile.',
);

assert.match(
  finalStyleSource,
  /body:is\(\.theme-light,\s*\.theme-high-contrast-light\) #root \.analysis-page-shell \.analysis-profile-reference-card\.is-trend \.analysis-overview-card-head\s*\{[^}]*display:\s*grid\s*!important;[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\)\s+auto\s*!important;[^}]*grid-template-rows:\s*auto\s+auto\s*!important;/,
  'Trend card header should provide a right-side stack for direction and delta.',
);

assert.match(
  finalStyleSource,
  /body:is\(\.theme-light,\s*\.theme-high-contrast-light\) #root \.analysis-page-shell \.analysis-profile-reference-card\.is-trend \.analysis-overview-vdot-trend-heading\s*\{[^}]*position:\s*static\s*!important;[^}]*grid-column:\s*2\s*!important;[^}]*grid-row:\s*1\s*!important;/,
  'Trend direction should sit above the delta value.',
);

assert.match(
  finalStyleSource,
  /body:is\(\.theme-light,\s*\.theme-high-contrast-light\) #root \.analysis-page-shell \.analysis-profile-reference-card\.is-trend \.analysis-overview-insight-delta\s*\{[^}]*grid-column:\s*2\s*!important;[^}]*grid-row:\s*2\s*!important;/,
  'Trend delta should remain below the direction heading.',
);

console.log('[PASS] Analysis bento card separation guard passed.');
