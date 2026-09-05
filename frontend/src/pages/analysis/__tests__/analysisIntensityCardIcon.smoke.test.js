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

assert.match(
  analysisSource,
  /import intensityDistributionCardIcon from ['"]\.\.\/\.\.\/assets\/intensity-distribution-card-icon\.webp['"];?/,
  'Analysis should import the generated intensity-distribution card icon.',
);

assert.match(
  analysisSource,
  /<span className="analysis-overview-card-kicker">\s*<img src=\{intensityDistributionCardIcon\} alt="" className="analysis-intensity-card-icon" \/>\s*\{t\('analysis\.stitch_intensity_title'\)\}/,
  'The intensity-distribution icon should sit beside the localized card label.',
);

assert.match(
  analysisStyle,
  /#root \.analysis-page-shell \.analysis-intensity-card-icon\s*\{[\s\S]*width:\s*clamp\([^)]+\)\s*!important;[\s\S]*height:\s*clamp\([^)]+\)\s*!important;[\s\S]*object-fit:\s*contain\s*!important;/,
  'The intensity-distribution icon should remain compact and preserve its generated proportions.',
);

console.log('[PASS] Analysis intensity-distribution card icon guard passed.');
