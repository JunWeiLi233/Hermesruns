import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const source = readFileSync(path.join(here, '../AnalysisInsightDetail.jsx'), 'utf8');
const chart = readFileSync(path.join(here, '../CoachLoadChart.jsx'), 'utf8');
const styles = readFileSync(path.join(here, '../../../styles/analysis-coach-bento.css'), 'utf8');
const branchStart = source.indexOf("insightKey === 'coach-insight' && coachSystem ? (");
const branchEnd = source.indexOf(") : insightKey === 'injury-risk' ? (", branchStart);
const coachBranch = source.slice(branchStart, branchEnd);

assert.ok(branchStart >= 0 && branchEnd > branchStart, 'Coach Insight branch should remain addressable.');
assert.match(source, /function buildLoadChartGeometry\(loadDashboard, layoutWidth = 920, withBand = false\)/, 'Load Balance should keep its existing chart geometry.');
assert.match(source, /const coachLoadDashboard = useMemo\([\s\S]*buildLoadBalanceDashboardModel\([\s\S]*coachPerformanceWindow/, 'Coach Insight should derive load data from the selected window.');
assert.match(coachBranch, /<CoachLoadChart key=\{coachPerformanceWindow\} dashboard=\{coachLoadDashboard\}/, 'Coach chart should reset its selection when switching windows.');
assert.match(chart, /dashboard\.chartWindow\.map/, 'Accessible history should expose every load data point.');
assert.match(chart, /geometry\.acutePath/, 'Coach chart should render acute load.');
assert.match(chart, /geometry\.chronicPath/, 'Coach chart should render chronic load.');
assert.match(chart, /new ResizeObserver/, 'Coach chart should measure its actual container.');
assert.match(chart, /getCoachLoadTooltipPosition\(selected, geometry\)/, 'Tooltip should follow the selected point within the plot.');
assert.match(chart, /aria-valuetext/, 'Keyboard inspection should expose the selected values.');
assert.doesNotMatch(styles, /min-width:\s*560px/, 'Phone charts should fit without horizontal scrolling.');
console.log('[PASS] Coach Insight chart integration guard passed.');