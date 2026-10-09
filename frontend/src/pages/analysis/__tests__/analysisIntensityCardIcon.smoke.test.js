import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const srcRoot = path.resolve(here, '../../..');
const analysisSource = readFileSync(path.join(here, '../Analysis.jsx'), 'utf8');
const analysisStyle = readFileSync(path.join(srcRoot, 'styles/analysis-summary.css'), 'utf8');

assert.ok(
  existsSync(path.join(srcRoot, 'assets/intensity-distribution-card-icon.webp')),
  'The generated intensity-distribution card icon should be stored in the frontend asset tree.',
);

assert.doesNotMatch(
  analysisSource,
  /import intensityDistributionCardIcon from ['"]\.\.\/\.\.\/assets\/intensity-distribution-card-icon\.webp['"];?/,
  'The v2 intensity tile should not load the retired overview icon.',
);

assert.match(
  analysisSource,
  /analysis-v2-check--intensity[\s\S]*?navigate\('\/analysis\/intensity'\)[\s\S]*?stitch_intensity_title/,
  'The intensity tile should retain its localized link to the detail page.',
);

assert.match(
  analysisStyle,
  /#root \.analysis-page-shell \.analysis-intensity-card-icon\s*\{[\s\S]*width:\s*clamp\([^)]+\)\s*!important;[\s\S]*height:\s*clamp\([^)]+\)\s*!important;[\s\S]*object-fit:\s*contain\s*!important;/,
  'The intensity-distribution icon should remain compact and preserve its generated proportions.',
);

console.log('[PASS] Analysis intensity-distribution card icon guard passed.');
