import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const srcRoot = path.resolve(here, '..');
const analysisSource = readFileSync(path.join(here, '../Analysis.jsx'), 'utf8');
const analysisStyle = readFileSync(path.join(srcRoot, 'styles/analysis-summary.css'), 'utf8');

assert.ok(
  existsSync(path.join(srcRoot, 'assets/injury-risk-icon.png')),
  'The generated injury-risk icon should be stored in the frontend asset tree.',
);

assert.match(
  analysisSource,
  /import injuryRiskIcon from ['"]\.\.\/assets\/injury-risk-icon\.png['"];?/,
  'Analysis should import the generated injury-risk icon.',
);

assert.match(
  analysisSource,
  /<img\s+src=\{injuryRiskIcon\}\s+alt=""\s+className="analysis-injury-risk-icon"\s*\/>[\s\S]*analysis\.stitch_injury_title/,
  'The injury-risk icon should be decorative because the adjacent localized label names the card.',
);

assert.match(
  analysisStyle,
  /#root \.analysis-page-shell \.analysis-profile-reference-card\.is-injury \.analysis-overview-card-title-block\s*\{[\s\S]*display:\s*inline-flex\s*!important;[\s\S]*align-items:\s*center\s*!important;/,
  'The injury-risk title row should align the generated icon with its label.',
);

assert.match(
  analysisStyle,
  /#root \.analysis-page-shell \.analysis-injury-risk-icon\s*\{[\s\S]*width:\s*clamp\([^)]+\)\s*!important;[\s\S]*height:\s*clamp\([^)]+\)\s*!important;[\s\S]*object-fit:\s*contain\s*!important;/,
  'The injury-risk icon should remain compact and preserve its generated proportions.',
);

assert.match(
  analysisStyle,
  /#root \.analysis-page-shell \.analysis-profile-reference-card\.is-injury \.analysis-overview-card-kicker\s*\{[\s\S]*color:\s*var\(--ahs-teal,\s*#30b0c7\)\s*!important;/,
  'The injury-risk title should use the shared cyan accent.',
);

assert.match(
  analysisStyle,
  /#root \.analysis-page-shell \.analysis-profile-reference-card\.is-injury \.analysis-injury-risk-icon\s*\{[\s\S]*filter:\s*grayscale\(1\)\s+brightness\(0\)\s+saturate\(100%\)[^;]*\s*!important;/,
  'The injury-risk icon should use the same cyan accent as its title.',
);

console.log('[PASS] Analysis injury-risk icon guard passed.');
