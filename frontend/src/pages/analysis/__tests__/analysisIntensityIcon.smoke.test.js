import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const srcRoot = path.resolve(here, '..');
const analysisSource = readFileSync(path.join(here, '../Analysis.jsx'), 'utf8');
const analysisStyle = readFileSync(path.join(srcRoot, 'styles/analysis-summary.css'), 'utf8');

assert.ok(
  existsSync(path.join(srcRoot, 'assets/intensity-distribution-card-icon.png')),
  'The generated intensity-distribution icon should be stored in the frontend asset tree.',
);

assert.match(
  analysisSource,
  /import intensityDistributionCardIcon from ['"]\.\.\/assets\/intensity-distribution-card-icon\.png['"];?/,
  'Analysis should import the generated intensity-distribution icon.',
);

assert.match(
  analysisSource,
  /<img\s+src=\{intensityDistributionCardIcon\}\s+alt=""\s+className="analysis-intensity-card-icon"\s*\/>/,
  'The intensity-distribution icon should be decorative because the adjacent localized label names the card.',
);

assert.match(
  analysisStyle,
  /#root \.analysis-page-shell \.analysis-intensity-card-icon\s*\{[\s\S]*width:\s*clamp\([^)]+\)\s*!important;[\s\S]*height:\s*clamp\([^)]+\)\s*!important;[\s\S]*object-fit:\s*contain\s*!important;/,
  'The intensity-distribution icon should have a compact responsive size and preserve its generated proportions.',
);

console.log('[PASS] Analysis intensity-distribution icon guard passed.');
