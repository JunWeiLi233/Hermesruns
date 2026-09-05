import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const runsSource = readFileSync(path.join(here, "../Runs.jsx"), 'utf8');
const runsStyle = readFileSync(path.join(here, "../../../styles/_split/runs.css"), 'utf8');
const finalCascadeStyle = readFileSync(path.join(here, "../../../styles/analysis-detail-redesigns.css"), 'utf8');

assert.match(
  runsSource,
  /runs-profile-cockpit__heading[\s\S]*runs-profile-glance[\s\S]*runs-profile-workbench__filters[\s\S]*recent-runs-card-list/,
  'Runs should present a compact command header, glance rail, unified filters, and history in that order.',
);

assert.match(
  runsStyle,
  /Runs compact scan-first composition[\s\S]*\.runs-dashboard-page \.runs-profile-cockpit\s*\{[\s\S]*min-height:\s*0;[\s\S]*padding:\s*clamp\(14px, 1\.6vw, 20px\)/,
  'The Runs cockpit should no longer reserve an oversized hero height.',
);

assert.match(
  runsStyle,
  /\.runs-dashboard-page \.runs-profile-cockpit h1\s*\{[\s\S]*font-size:\s*clamp\(2\.35rem, 4vw, 3\.35rem\)/,
  'The Runs title should remain expressive without consuming most of the viewport.',
);

assert.match(
  runsStyle,
  /\.runs-dashboard-page \.runs-profile-cockpit__rail\s*\{[\s\S]*grid-template-columns:\s*repeat\(3, minmax\(0, 1fr\)\)/,
  'The three history signals should share one compact desktop row.',
);

assert.match(
  runsStyle,
  /\.runs-dashboard-page \.runs-profile-workbench\s*\{[\s\S]*grid-template-columns:\s*minmax\(260px, 0\.9fr\) minmax\(0, 1\.5fr\)/,
  'Search and filters should share one desktop workbench row.',
);

assert.match(
  runsStyle,
  /\.runs-dashboard-page \.runs-profile-glance\s*\{[\s\S]*grid-template-columns:\s*repeat\(2, minmax\(0, 1fr\)\)/,
  'Summary statistics and training insights should share one glance rail.',
);

assert.match(
  runsStyle,
  /\.runs-dashboard-page \.runs-profile-history \.recent-runs-month-grid\s*\{[\s\S]*minmax\(min\(100%, 370px\), 1fr\)/,
  'Desktop history should fit three readable cards when the canvas has enough width.',
);

assert.match(
  runsStyle,
  /\.runs-dashboard-page \.runs-profile-history button\.recent-runs-card\s*\{[\s\S]*grid-template-columns:\s*clamp\(108px, 30%, 126px\) minmax\(0, 1fr\);[\s\S]*min-height:\s*166px/,
  'Run cards should use a compact route preview and horizontal metric body.',
);

assert.match(
  runsStyle,
  /@media \(max-width: 680px\)[\s\S]*\.runs-dashboard-page \.runs-profile-history button\.recent-runs-card\s*\{[\s\S]*grid-template-columns:\s*104px minmax\(0, 1fr\)/,
  'Mobile run cards should stay scan-friendly without stacking every metric vertically.',
);

assert.match(
  finalCascadeStyle,
  /#root \.runs-dashboard-page \.runs-profile-history \.recent-runs-insight-card\.recent-runs-insight-card--primary\s*\{[\s\S]*min-height:\s*72px !important;[\s\S]*padding:\s*10px 12px 10px 16px !important;/,
  'The later analysis-detail cascade should not restore the oversized lead insight tile.',
);

assert.match(
  finalCascadeStyle,
  /#root \.runs-dashboard-page \.runs-profile-history \.recent-runs-insight-card\.recent-runs-insight-card--primary strong\s*\{[\s\S]*font-size:\s*clamp\(1rem, 1\.35vw, 1\.34rem\) !important;/,
  'The final cascade should keep the lead insight value compact.',
);

console.log('[PASS] Runs compact overview guardrails passed.');
