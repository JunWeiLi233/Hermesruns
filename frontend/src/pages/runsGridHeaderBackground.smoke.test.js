import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const runsSource = readFileSync(path.join(here, 'Runs.jsx'), 'utf8');
const liquidGlassStyleSource = readFileSync(path.join(here, '../styles/all-pages-liquid-glass.css'), 'utf8');

assert.match(
  runsSource,
  /className="recent-runs-card"[\s\S]*className="recent-runs-card-body"[\s\S]*className="recent-runs-card-top"[\s\S]*recent-runs-card-date[\s\S]*recent-runs-card-metrics/,
  'Run history should keep its card body, title/date region, and metric grid structure.',
);

assert.match(
  liquidGlassStyleSource,
  /Run-history cards have the same `-card` naming collision[\s\S]*\.runner-shell-page\.runs-dashboard-page \.runs-profile-history :is\([\s\S]*\.recent-runs-card-body,[\s\S]*\.recent-runs-card-top,[\s\S]*\.recent-runs-card-date,[\s\S]*\.recent-runs-card-metrics[\s\S]*\)\s*\{[\s\S]*background:\s*transparent !important;[\s\S]*background-image:\s*none !important;[\s\S]*box-shadow:\s*none !important;[\s\S]*backdrop-filter:\s*none !important;/,
  'Run-history content wrappers should not render accidental liquid-glass strips.',
);

assert.match(
  liquidGlassStyleSource,
  /\.runner-shell-page\.runs-dashboard-page \.runs-profile-history :is\([\s\S]*\.recent-runs-card-metrics[\s\S]*\)/,
  'The reset should stop at the metric-grid wrapper so individual metric tiles retain their own treatment.',
);

assert.match(
  liquidGlassStyleSource,
  /The profile-aligned card gradient is the remaining full-width strip[\s\S]*\.runner-shell-page\.runs-dashboard-page \.runs-profile-history button\.recent-runs-card\s*\{[\s\S]*background:\s*transparent !important;[\s\S]*background-image:\s*none !important;/,
  'The run card itself should not paint a full-width strip behind the content column.',
);

assert.doesNotMatch(
  liquidGlassStyleSource,
  /\.runner-shell-page \.runs-dashboard-page \.runs-profile-history/,
  'Run-history strip resets must not use a descendant selector for classes that share the page root.',
);

console.log('[PASS] Run-history grid background guardrails passed.');
