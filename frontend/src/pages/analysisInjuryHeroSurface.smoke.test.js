import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const source = readFileSync(path.join(here, 'AnalysisInsightDetail.jsx'), 'utf8');
const injuryBranchStart = source.indexOf("insightKey === 'injury-risk' ? (");
const injuryBranchEnd = source.indexOf("insightKey === 'load-balance'", injuryBranchStart);
const injuryBranch = source.slice(injuryBranchStart, injuryBranchEnd);

assert.ok(injuryBranchStart >= 0 && injuryBranchEnd > injuryBranchStart, 'The injury-risk detail branch should remain addressable.');
assert.doesNotMatch(
  injuryBranch,
  /analysis-cinematic-live-pill/,
  'The injury-risk hero should not render the removable live-risk pill.',
);
assert.doesNotMatch(
  source,
  /const injuryHeroLabel = t\('analysis\.injury_cinematic_live'\)/,
  'The removed hero pill should not leave an unused label binding behind.',
);
assert.doesNotMatch(
  injuryBranch,
  /analysis-cinematic-hero analysis-profile-v2-header|\{injuryHeroTitle\}|\{injuryHeroSubtitle\}|analysis-profile-v2-ring/,
  'The Injury Risk hero shown in the reference should be removed completely.',
);
assert.match(
  injuryBranch,
  /analysis-profile-v2-focus|analysis-injury-profile-chart-card/,
  'Removing the hero must preserve the Injury Risk detail content below it.',
);

console.log('[PASS] Injury-risk hero surface guard passed.');
