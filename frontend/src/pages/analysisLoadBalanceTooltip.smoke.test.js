import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const insightSource = readFileSync(path.join(here, 'AnalysisInsightDetail.jsx'), 'utf8');
const styleSource = readFileSync(path.join(here, '..', 'styles', 'analysis-load-balance-profile-alignment.css'), 'utf8');

assert.match(
  insightSource,
  /analysis-load-command-chart-tooltip-head/,
  'Load-balance tooltip should expose a dedicated date header for the selected point.',
);
assert.match(
  insightSource,
  /analysis-load-command-chart-tooltip-metric is-acute/,
  'Load-balance tooltip should expose a distinct acute metric row.',
);
assert.match(
  insightSource,
  /analysis-load-command-chart-tooltip-metric is-chronic/,
  'Load-balance tooltip should expose a distinct chronic metric row.',
);
assert.match(
  styleSource,
  /\.analysis-insight-detail-page\.is-load-balance \.analysis-load-command-chart-tooltip\s*\{(?=[^}]*min-width:\s*168px;)(?=[^}]*z-index:\s*4;)[^}]*\}/,
  'Load-balance tooltip should have a readable, layered data-card treatment.',
);
const tooltipRule = styleSource.match(
  /\.analysis-insight-detail-page\.is-load-balance \.analysis-load-command-chart-tooltip\s*\{([\s\S]*?)\}/,
);
assert.ok(tooltipRule, 'Load-balance tooltip surface rule should remain identifiable.');
assert.match(
  tooltipRule[1],
  /background:\s*#fff;/,
  'Load-balance tooltip should use a white background.',
);
assert.match(
  tooltipRule[1],
  /color:\s*var\(--load-profile-ink\);/,
  'Load-balance tooltip should switch to dark text on the white surface.',
);
assert.match(
  styleSource,
  /\.analysis-insight-detail-page\.is-load-balance \.analysis-load-command-chart-tooltip-metric\.is-acute\s*>\s*i\s*\{[\s\S]*?background:\s*#f07561;/,
  'Acute load should use the chart coral accent in the tooltip.',
);
assert.match(
  styleSource,
  /\.analysis-insight-detail-page\.is-load-balance \.analysis-load-command-chart-tooltip-metric\.is-chronic\s*>\s*i\s*\{[\s\S]*?background:\s*#78b4ff;/,
  'Chronic load should use the chart blue accent in the tooltip.',
);

console.log('[PASS] Load-balance tooltip redesign guard passed.');
