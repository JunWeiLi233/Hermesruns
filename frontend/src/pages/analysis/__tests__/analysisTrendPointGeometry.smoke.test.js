import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const read = (relativePath) => readFileSync(path.join(here, '../../..', relativePath), 'utf8');
const pageSource = read('pages/analysis/AnalysisInsightDetail.jsx');
const chartStyleSource = read('styles/_split/analysis.css');

assert.match(
  pageSource,
  /function getTrendPointStyle\(point\)[\s\S]*?INJURY_TREND_CHART_WIDTH[\s\S]*?INJURY_TREND_CHART_HEIGHT/,
  'Trend markers must derive their CSS position from the same chart coordinate system.',
);
assert.match(
  pageSource,
  /<span\s+key=\{`injury-point-\$\{point\.x\}`\}\s+className="analysis-cinematic-point"\s+style=\{getTrendPointStyle\(point\)\}/,
  'Injury trend markers must render as positioned HTML points instead of stretched SVG circles.',
);
assert.doesNotMatch(
  pageSource,
  /<circle key=\{point\.x\} cx=\{point\.x\} cy=\{point\.y\} r="6" className="analysis-cinematic-point"/,
  'Injury trend markers must not remain SVG circles inside a non-uniformly scaled SVG.',
);
assert.match(
  chartStyleSource,
  /\.analysis-cinematic-point\s*\{[\s\S]*?position:\s*absolute;[\s\S]*?width:\s*12px;[\s\S]*?height:\s*12px;[\s\S]*?border-radius:\s*50%;/,
  'Injury trend markers must use a fixed square CSS circle.',
);

console.log('[PASS] Analysis trend point geometry guardrails passed.');
