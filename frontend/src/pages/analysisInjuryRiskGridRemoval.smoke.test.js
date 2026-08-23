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
assert.doesNotMatch(
  injuryBranch,
  /analysis-cinematic-card--risk|analysis-cinematic-main-column|analysis-cinematic-risk-/,
  'The obsolete injury-risk summary grid should not render after the card is removed.',
);
assert.doesNotMatch(
  visualStyles,
  /analysis-cinematic-card--risk|analysis-cinematic-main-column|analysis-cinematic-risk-glow|analysis-cinematic-risk-copy/,
  'The obsolete injury-risk grid styles should not remain as orphaned CSS.',
);
assert.match(
  visualStyles,
  /\.analysis-profile-v2--injury \.analysis-profile-v2-evidence-grid\s*\{[\s\S]*?"trend samples"\s*"support support";/,
  'The remaining injury evidence cards should use a two-row layout after removing the risk grid.',
);
const mediumBreakpointStart = visualStyles.indexOf('@media (max-width: 960px)');
const smallBreakpointStart = visualStyles.indexOf('@media (max-width: 760px)', mediumBreakpointStart);
assert.ok(mediumBreakpointStart >= 0 && smallBreakpointStart > mediumBreakpointStart, 'The Injury Risk responsive evidence rule should remain addressable.');
const mediumBreakpointStyles = visualStyles.slice(mediumBreakpointStart, smallBreakpointStart);
assert.doesNotMatch(
  mediumBreakpointStyles,
  /\.analysis-profile-v2--injury \.analysis-profile-v2-evidence-grid\s*\{[\s\S]*?"risk"/,
  'The removed Injury Risk risk area should not return at the medium breakpoint.',
);
assert.match(
  mediumBreakpointStyles,
  /\.analysis-profile-v2--injury \.analysis-profile-v2-evidence-grid\s*\{[\s\S]*?"trend"\s*"samples"\s*"support";/,
  'Injury Risk should stack only the remaining trend, samples, and support areas on smaller screens.',
);

console.log('[PASS] Injury-risk obsolete grid removal guard passed.');
