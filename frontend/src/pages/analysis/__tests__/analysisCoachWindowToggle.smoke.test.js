import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const source = readFileSync(path.join(here, "../AnalysisInsightDetail.jsx"), 'utf8');
const styles = readFileSync(path.join(here, "../../../styles/analysis-profile-visual-alignment.css"), 'utf8');
const branchStart = source.indexOf("insightKey === 'coach-insight' && coachSystem ? (");
const branchEnd = source.indexOf(") : insightKey === 'injury-risk' ? (", branchStart);
const coachBranch = source.slice(branchStart, branchEnd);

assert.ok(branchStart >= 0 && branchEnd > branchStart, 'Coach Insight branch should remain addressable.');
assert.match(source, /const \[coachPerformanceWindow, setCoachPerformanceWindow\] = useState\(7\)/, 'Coach Insight should own the selected performance window.');
assert.match(source, /buildLoadBalanceDashboardModel\([\s\S]*coachPerformanceWindow\)/, 'Coach Insight should derive chart data from the selected window.');
assert.match(coachBranch, /role="group"/, 'Coach window control should expose a button group.');
assert.match(coachBranch, /<button type="button"[^>]*aria-pressed=\{coachPerformanceWindow === 7\}/, '7-day control should expose its pressed state.');
assert.match(coachBranch, /<button type="button"[^>]*aria-pressed=\{coachPerformanceWindow === 28\}/, '28-day control should expose its pressed state.');
assert.match(coachBranch, /onClick=\{\(\) => setCoachPerformanceWindow\(7\)\}/, '7-day control should update the selected window.');
assert.match(coachBranch, /onClick=\{\(\) => setCoachPerformanceWindow\(28\)\}/, '28-day control should update the selected window.');
assert.match(coachBranch, /coachLoadDashboard\.chartWindow\.map/, 'Coach chart should render the selected-window trend.');
assert.match(
  styles,
  /body #root \.analysis-insight-detail-page\.is-coach-insight[\s\S]*?\.analysis-coach-command-window-toggle button\s*\{/,
  'Coach window buttons should have route-scoped styling.',
);
assert.match(
  styles,
  /\.analysis-coach-command-window-toggle button:focus-visible\s*\{[\s\S]*?outline:\s*2px solid var\(--analysis-v2-ink\);/,
  'Coach window focus highlight should use the black ink treatment.',
);
assert.doesNotMatch(
  styles,
  /\.analysis-coach-command-window-toggle button:focus-visible\s*\{[\s\S]*?outline:\s*2px solid var\(--analysis-v2-coral\);/,
  'Coach window focus highlight should not use the coral accent.',
);

console.log('[PASS] Coach Insight window toggle guard passed.');
