import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const analysisSource = readFileSync(path.join(here, '../Analysis.jsx'), 'utf8');
const summaryStyle = readFileSync(path.join(here, '../../../styles/analysis-summary.css'), 'utf8');

assert.match(
  analysisSource,
  /<article className="analysis-overview-card analysis-overview-card--vo2 analysis-v2-vo2">/,
  'Analysis VO2 trend should remain a static article in the v2 hero.',
);

assert.doesNotMatch(
  analysisSource,
  /navigate\('\/analysis\/vo2max'\)/,
  'Analysis overview should not navigate from the VO2 trend grid to a removed VO2max detail page.',
);

assert.match(
  analysisSource,
  /data-analysis-load-theme=\{analysisLoadTheme\}/,
  'Analysis route root should expose the training-load theme to CSS.',
);

assert.match(
  analysisSource,
  /trainingLoad\?\.lastAcwr != null \? \([\s\S]*?<i style=/,
  'The load scale should not render a marker without an ACWR measurement.',
);

assert.match(
  summaryStyle,
  /--analysis-gauge-value-color/,
  'Analysis summary styles should support gauge value color sync with the status arc.',
);

assert.match(
  summaryStyle,
  /\.analysis-overview-vdot-title[\s\S]*color:\s*#ff634f/,
  'Fitness/VO2 title accent should stay coral in the analysis summary layer.',
);

console.log('[PASS] Analysis VDOT trend accent guardrails passed.');
