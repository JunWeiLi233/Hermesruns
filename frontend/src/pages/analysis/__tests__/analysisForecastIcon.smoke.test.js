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

assert.match(
  analysisSource,
  /import performanceForecastIcon from ['"]\.\.\/\.\.\/assets\/performance-forecast-icon\.webp['"];?/,
  'Analysis should import the generated performance-forecast icon.',
);

assert.match(
  analysisSource,
  /<span className="analysis-overview-card-kicker">\s*<img src=\{performanceForecastIcon\} alt="" className="analysis-performance-forecast-icon" \/>\s*\{t\('analysis\.stitch_forecast_title'\)\}/,
  'The performance-forecast icon should sit beside the localized card label.',
);

assert.match(
  analysisStyle,
  /#root \.analysis-page-shell \.analysis-performance-forecast-icon\s*\{[\s\S]*width:\s*clamp\([^)]+\)\s*!important;[\s\S]*height:\s*clamp\([^)]+\)\s*!important;[\s\S]*object-fit:\s*contain\s*!important;/,
  'The performance-forecast icon should remain compact and preserve its generated proportions.',
);

console.log('[PASS] Analysis performance-forecast icon guard passed.');
