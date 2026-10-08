import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const here = path.dirname(fileURLToPath(import.meta.url));
const source = readFileSync(path.join(here, '../AnalysisInsightDetail.jsx'), 'utf8');
const styles = readFileSync(path.join(here, '../../../styles/analysis-load-balance-v2.css'), 'utf8');
const start = source.indexOf(") : insightKey === 'load-balance' && loadDashboard ? (");
const end = source.indexOf(") : insightKey === 'intensity' && intensityDashboard ? (", start);
assert.ok(start >= 0 && end > start);
const branch = source.slice(start, end);
assert.doesNotMatch(branch, /loadBalanceTrack|analysis-load-profile-visual|<picture>/, 'The v2 verdict must omit the decorative track image.');
for (const marker of ['analysis-load-v2-verdict', 'analysis-load-v2-window', 'CoachIdentityBadge', 'loadDashboard.ratioValue', 'loadDashboard.judgmentTitle']) {
  assert.ok(branch.includes(marker), 'The verdict must preserve ' + marker);
}
assert.match(styles, /background:\s*var\(--lb-card\)/, 'The verdict must use the theme-aware card surface.');
assert.match(styles, /color:\s*var\(--lb-ink\)\s*!important/, 'The verdict title must remain readable on its card.');
assert.match(styles, /theme-midnight/, 'The v2 cards must support dark mode.');
console.log('[PASS] Load Balance v2 verdict and theme guardrails passed.');
