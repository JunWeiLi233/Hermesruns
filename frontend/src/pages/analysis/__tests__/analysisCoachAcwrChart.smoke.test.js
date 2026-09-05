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
assert.match(source, /function buildLoadChartGeometry\(loadDashboard\)/, 'ACWR chart geometry should be shared with Load Balance.');
assert.match(source, /const coachLoadDashboard = useMemo\([\s\S]*buildLoadBalanceDashboardModel\([\s\S]*coachPerformanceWindow/, 'Coach Insight should derive ACWR data from the selected window.');
assert.match(source, /const coachLoadChartGeometry = useMemo\([\s\S]*buildLoadChartGeometry\(coachLoadDashboard\)/, 'Coach Insight should use the shared ACWR geometry.');
assert.match(coachBranch, /analysis-coach-command-acwr-chart-svg/, 'Coach Insight should use the Load Balance ACWR chart renderer.');
assert.match(coachBranch, /coachLoadDashboard\.chartWindow\.map/, 'Coach accessible history should expose ACWR data points.');
assert.match(coachBranch, /coachLoadChartGeometry\.acutePath/, 'Coach Insight should render the acute ACWR series.');
assert.match(coachBranch, /coachLoadChartGeometry\.chronicPath/, 'Coach Insight should render the chronic ACWR series.');
assert.match(coachBranch, /coachLoadScrubber/, 'Coach Insight should retain chart scrubber feedback.');
assert.match(
  styles,
  /body #root \.analysis-insight-detail-page\.is-coach-insight[\s\S]*?\.analysis-load-command-chart-tooltip\s*\{/,
  'Coach Insight should have a route-scoped ACWR tooltip design.',
);
assert.match(
  styles,
  /body #root \.analysis-insight-detail-page\.is-coach-insight[\s\S]*?\.analysis-load-command-chart-tooltip\s*\{[\s\S]*?min-width:\s*168px[\s\S]*?padding:\s*12px 14px 13px[\s\S]*?border-radius:\s*14px[\s\S]*?background:\s*#fff/,
  'Coach tooltip should match the Load Balance card proportions and light surface.',
);
assert.match(
  styles,
  /body #root \.analysis-insight-detail-page\.is-coach-insight[\s\S]*?\.analysis-load-command-chart-tooltip-head\s*\{[\s\S]*?justify-content:\s*space-between/,
  'Coach tooltip header should keep the date row layout.',
);
assert.doesNotMatch(
  styles,
  /body #root \.analysis-insight-detail-page\.is-coach-insight[\s\S]*?\.analysis-load-command-chart-tooltip-head\s+i\s*\{/,
  'Coach tooltip should not render a decorative marker beside the date.',
);
assert.match(styles, /\.analysis-load-command-chart-tooltip-metrics\s*\{[\s\S]*?display:\s*grid/, 'Coach tooltip metrics should use stacked rows.');

console.log('[PASS] Coach Insight ACWR chart guard passed.');
