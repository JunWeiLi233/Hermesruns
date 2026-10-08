import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const srcRoot = path.resolve(here, '../../..');
const analysisSource = readFileSync(path.join(here, '../Analysis.jsx'), 'utf8');
const analysisStyle = readFileSync(path.join(srcRoot, 'styles/analysis-summary.css'), 'utf8');

assert.ok(
  existsSync(path.join(srcRoot, 'assets/injury-risk-icon.webp')),
  'The generated injury-risk icon should be stored in the frontend asset tree.',
);

assert.doesNotMatch(
  analysisSource,
  /import injuryRiskIcon from ['"]\.\.\/\.\.\/assets\/injury-risk-icon\.webp['"];?/,
  'The v2 injury tile should not load the retired overview icon.',
);

assert.match(
  analysisSource,
  /analysis-v2-check--injury[\s\S]*?navigate\('\/analysis\/injury-risk'\)[\s\S]*?analysis\.stitch_injury_title/,
  'The injury tile should retain its localized link to the detail page.',
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
