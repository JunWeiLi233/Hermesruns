import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const pageSource = readFileSync(path.join(here, 'AnalysisInsightDetail.jsx'), 'utf8');
const visualStyles = readFileSync(path.join(here, '..', 'styles', 'analysis-profile-visual-alignment.css'), 'utf8');
const injuryBranchStart = pageSource.indexOf("insightKey === 'injury-risk' ? (");
const injuryBranchEnd = pageSource.indexOf("insightKey === 'load-balance'", injuryBranchStart);
const injuryBranch = pageSource.slice(injuryBranchStart, injuryBranchEnd);

assert.ok(injuryBranchStart >= 0 && injuryBranchEnd > injuryBranchStart, 'The injury-risk detail branch should remain addressable.');
assert.match(
  pageSource,
  /import injuryKneeAnatomy from '\.\.\/assets\/generated\/injury-knee-anatomy\.webp';/,
  'The injury-risk hero should import the supplied knee anatomy artwork.',
);
assert.match(
  injuryBranch,
  /className="analysis-injury-knee-art" aria-hidden="true"\s*>\s*<img src=\{injuryKneeAnatomy\} alt=""(?:\s+[^>]*)?\/>/s,
  'The injury-risk focus card should render the knee artwork as decorative media.',
);
assert.match(
  visualStyles,
  /\.analysis-profile-v2--injury \.analysis-injury-knee-art\s*\{[\s\S]*?position:\s*absolute;[\s\S]*?pointer-events:\s*none;/,
  'The knee artwork should be positioned as a non-interactive hero layer.',
);
assert.match(
  visualStyles,
  /\.analysis-profile-v2--injury \.analysis-injury-knee-art img\s*\{[\s\S]*?object-fit:\s*cover;/,
  'The knee artwork should cover its visual frame without distorting the anatomy.',
);
assert.match(
  visualStyles,
  /body #root \.analysis-insight-detail-page\.is-injury-risk \.analysis-profile-v2-focus \.analysis-profile-v2-focus-title\s*\{[\s\S]*?color:\s*#fff8f1\s*!important;/,
  'The injury-risk coach title should remain white above the light-theme heading override.',
);

console.log('[PASS] Injury-risk knee hero guard passed.');
