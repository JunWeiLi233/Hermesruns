import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const srcRoot = path.resolve(here, "../../..");
const read = (relativePath) => readFileSync(path.join(srcRoot, relativePath), 'utf8');

const pageSource = read('./pages/analysis/AnalysisInsightDetail.jsx');
const styleSource = read('./styles/analysis-profile-visual-alignment.css');

const injuryBranchStart = pageSource.indexOf("insightKey === 'injury-risk' ? (");
const injuryBranchEnd = pageSource.indexOf("insightKey === 'load-balance'", injuryBranchStart);
assert.ok(injuryBranchStart >= 0 && injuryBranchEnd > injuryBranchStart, 'The injury-risk branch should remain addressable.');

const injuryBranch = pageSource.slice(injuryBranchStart, injuryBranchEnd);
assert.doesNotMatch(
  injuryBranch,
  /analysis-profile-v2-ring|--analysis-v2-progress/,
  'The removed Injury Risk hero must not leave its readiness ring in the route branch.',
);
assert.doesNotMatch(
  styleSource,
  /\.analysis-profile-v2--injury \.analysis-profile-v2-ring|\.analysis-profile-v2-ring\s*[,:{]/,
  'The removed Injury Risk readiness ring must not leave orphaned CSS behind.',
);

console.log('[PASS] Injury Profile v2 ring contract passed.');
