import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const srcRoot = path.resolve(here, '..');
const read = (relativePath) => readFileSync(path.join(srcRoot, relativePath), 'utf8');

const pageSource = read('pages/AnalysisInsightDetail.jsx');
const styleSource = read('styles/analysis-profile-visual-alignment.css');

const injuryBranchStart = pageSource.indexOf("insightKey === 'injury-risk' ? (");
const injuryBranchEnd = pageSource.indexOf("insightKey === 'load-balance'", injuryBranchStart);
assert.ok(injuryBranchStart >= 0 && injuryBranchEnd > injuryBranchStart, 'The injury-risk branch should remain addressable.');

const injuryBranch = pageSource.slice(injuryBranchStart, injuryBranchEnd);
assert.match(injuryBranch, /className="analysis-profile-v2-ring"/);
assert.match(
  injuryBranch,
  /'--analysis-v2-progress':\s*`\$\{Math\.min\(100, Math\.max\(0, snapshot\.injury\.score\)\) \* 3\.6\}deg`/,
  'The injury ring must continue to derive its progress from the clamped injury score.',
);

assert.match(
  styleSource,
  /\.analysis-profile-v2--injury \.analysis-profile-v2-ring\s*\{[\s\S]*?box-sizing:\s*border-box;[\s\S]*?border:\s*0;[\s\S]*?background:\s*conic-gradient\(\s*from -90deg/,
  'The injury ring must use a border-box conic track instead of painting progress beneath a solid border.',
);
assert.match(
  styleSource,
  /\.analysis-profile-v2--injury \.analysis-profile-v2-ring::before\s*\{[\s\S]*?background:\s*var\(--analysis-v2-paper\)/,
  'The injury ring must mask its center with the active Profile surface.',
);
assert.match(
  styleSource,
  /\.analysis-profile-v2--injury \.analysis-profile-v2-ring\s*>\s*\*\s*\{[\s\S]*?position:\s*relative;[\s\S]*?z-index:\s*1;/,
  'The injury ring value and denominator must remain above the track mask.',
);

console.log('[PASS] Injury Profile v2 ring contract passed.');
