import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const styleSource = readFileSync(path.join(here, '../styles/_split/runs.css'), 'utf8');

assert.match(
  styleSource,
  /\.recent-runs-month-grid\s*\{[\s\S]*grid-template-columns:\s*repeat\(auto-fit, minmax\(min\(100%, 500px\), 1fr\)\)[\s\S]*gap:\s*14px/,
  'Run groups should add columns only when every card retains a readable minimum width.',
);

assert.match(
  styleSource,
  /\.recent-runs-card\s*\{[\s\S]*grid-template-columns:\s*clamp\(136px, 30%, 168px\) minmax\(0, 1fr\)/,
  'Run cards should reserve a bounded route-preview column and a flexible content column.',
);

assert.match(
  styleSource,
  /\.recent-runs-card-metric strong\s*\{[\s\S]*font-size:\s*clamp\(0\.98rem, 1\.35vw, 1\.18rem\)[\s\S]*white-space:\s*nowrap/,
  'Run metric values should remain horizontal instead of clipping into narrow columns.',
);

assert.match(
  styleSource,
  /@media \(max-width: 680px\)[\s\S]*\.runs-dashboard-page \.runs-profile-history \.recent-runs-card-metrics\s*\{[\s\S]*grid-template-columns:\s*repeat\(3, minmax\(0, 1fr\)\)/,
  'Mobile run cards should keep a compact three-metric row beneath the route preview.',
);

assert.doesNotMatch(
  styleSource,
  /@media \(max-width: 900px\)\s*\{[\s\S]{0,500}\.recent-runs-card-metrics\s*\{[\s\S]{0,120}grid-template-columns:\s*1fr/,
  'Tablet cards should not regress the metric row into a tall single-column stack.',
);

console.log('[PASS] Run-card responsive grid guardrails passed.');
