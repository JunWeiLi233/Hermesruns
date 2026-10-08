import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const srcRoot = path.resolve(here, '../../..');
const analysisSource = readFileSync(path.join(here, '../Analysis.jsx'), 'utf8');
const analysisStyle = readFileSync(path.join(srcRoot, 'styles/analysis-summary.css'), 'utf8');

assert.ok(
  existsSync(path.join(srcRoot, 'assets/performance-forecast-icon.webp')),
  'The generated performance-forecast icon should be stored in the frontend asset tree.',
);

assert.doesNotMatch(
  analysisSource,
  /import performanceForecastIcon from ['"]\.\.\/\.\.\/assets\/performance-forecast-icon\.webp['"];?/,
  'The predictions list should not load the retired forecast-card icon.',
);

assert.match(
  analysisSource,
  /predictionRows\.map\(\(row\) => \{[\s\S]*?<Link className="analysis-v2-prediction-row" to=\{`\/prediction\/\$\{row\.key\}`\}/,
  'Every race prediction should link to its existing detail route.',
);

assert.match(
  analysisStyle,
  /#root \.analysis-page-shell \.analysis-performance-forecast-icon\s*\{[\s\S]*width:\s*clamp\([^)]+\)\s*!important;[\s\S]*height:\s*clamp\([^)]+\)\s*!important;[\s\S]*object-fit:\s*contain\s*!important;/,
  'The performance-forecast icon should remain compact and preserve its generated proportions.',
);

console.log('[PASS] Analysis performance-forecast icon guard passed.');
