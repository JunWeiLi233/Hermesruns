import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const srcRoot = path.resolve(here, '..');
const read = (relativePath) => readFileSync(path.join(srcRoot, relativePath), 'utf8');

const navSource = read('components/AnalysisSubpageNav.jsx');
const insightSource = read('pages/AnalysisInsightDetail.jsx');
const predictionSource = read('pages/PredictionDetail.jsx');
const profileSource = read('pages/ProfileDashboard.jsx');
const indexSource = read('index.css');
const loadBalanceCss = read('styles/analysis-load-balance-profile-alignment.css');
const profileVisualAlignmentCss = read('styles/analysis-profile-visual-alignment.css');
const analysisRoutes = [
  '/analysis',
  '/analysis/load-balance',
  '/analysis/intensity',
  '/analysis/injury-risk',
  '/analysis/coach-insight',
  '/prediction/5k',
  '/prediction/10k',
  '/prediction/half',
  '/prediction/marathon',
];

for (const route of analysisRoutes) {
  const routeIndex = navSource.indexOf(route);
  assert.ok(routeIndex >= 0, `Analysis subpage navigation is missing ${route}.`);
}

assert.match(
  navSource,
  /const navItems = \[[\s\S]*?key: 'analysis'[\s\S]*?\.\.\.INSIGHT_ITEMS\.map[\s\S]*?\.\.\.PREDICTION_ITEMS\.map/,
  'The rendered rail must keep overview, insights, and predictions in that order.',
);

assert.match(
  navSource,
  /\{ key: 'half', route: '\/prediction\/half', icon: 'timer' \}/,
  'Half Marathon should reuse the same timer icon as the 5K prediction link.',
);

for (const className of [
  'runner-shell-sidebar',
  'runner-shell-brand runner-dashboard-brand',
  'runner-dashboard-brand-copy',
  'runner-dashboard-sidebar-toggle',
  'runner-shell-side-nav',
  'runner-shell-side-link',
  'runner-dashboard-side-link-icon',
  'runner-dashboard-side-link-label',
  'runner-shell-sidebar-footer',
  'runner-shell-workout-btn runner-dashboard-workout-btn',
]) {
  assert.ok(navSource.includes(className), `Analysis subpages must use the Profile sidebar class ${className}.`);
  assert.ok(profileSource.includes(className), `Profile must remain the visual parity source for ${className}.`);
}

assert.match(navSource, /import \{ RACE_DISTANCES \} from '\.\.\/utils\/vdot';/);
assert.match(navSource, /active: item\.key === activeInsightKey/);
assert.match(navSource, /active: item\.key === activePredictionKey/);
assert.match(navSource, /aria-current=\{item\.active \? 'page' : undefined\}/);
assert.match(navSource, /analysis\.subnav_title/);
assert.match(navSource, /analysis\.pred_open_today/);
assert.doesNotMatch(navSource, /analysis-subnav|analysis-subnav-link|analysis-subnav-current/, 'Analysis subpages must not render the obsolete sidebar styling.');

for (const source of [insightSource, predictionSource]) {
  assert.match(source, /import AnalysisSubpageNav from '\.\.\/components\/AnalysisSubpageNav';/);
  assert.match(source, /<AnalysisSubpageNav/);
}

for (const marker of [
  'analysis-load-profile-header',
  'analysis-load-profile-decision',
  'analysis-load-profile-evidence',
  'analysis-load-profile-metrics',
  'analysis-load-profile-ledger',
]) {
  assert.ok(insightSource.includes(marker), `Load Balance is missing ${marker}.`);
}

assert.doesNotMatch(
  insightSource,
  /analysis-load-profile-methodology|analysis-load-command-methodology-card/,
  'Load Balance must not render the removed ACWR methodology grid.',
);

assert.ok(
  insightSource.indexOf('analysis-load-profile-decision') < insightSource.indexOf('analysis-load-profile-evidence'),
  'The coaching decision must precede analytical evidence.',
);
assert.match(insightSource, /onPointerMove=\{handleLoadPointerMove\}/);
assert.match(insightSource, /onPointerLeave=\{handleLoadPointerLeave\}/);
assert.match(insightSource, /navigate\('\/today-run'\)/);
assert.match(insightSource, /navigate\(buildRunDetailPath\(row\.id\)\)/);
assert.match(indexSource, /analysis-load-balance-profile-alignment\.css/);
assert.match(
  profileVisualAlignmentCss,
  /body #root \.analysis-insight-detail-page\.is-coach-insight \.runner-shell-side-link\.is-active\s*\{[\s\S]*?border-color:\s*transparent\s*!important;[\s\S]*?background:\s*transparent\s*!important;[\s\S]*?box-shadow:\s*none\s*!important;/,
  'Coach Insight should keep its active rail label text-first without a panel strip.',
);
assert.match(loadBalanceCss, /prefers-reduced-motion/);
assert.match(loadBalanceCss, /theme-midnight/);
const loadDecisionIndex = loadBalanceCss.indexOf('.analysis-insight-detail-page.is-load-balance .analysis-load-profile-decision {');
assert.ok(loadDecisionIndex >= 0, 'Load Balance should have a decision surface rule.');
assert.match(
  loadBalanceCss.slice(loadDecisionIndex, loadDecisionIndex + 760),
  /background:[\s\S]*#fffdf9/,
  'The Load Balance decision surface should use the white Profile treatment in the default theme.',
);
assert.match(
  loadBalanceCss,
  /\.analysis-insight-detail-page\.is-load-balance \.analysis-load-profile-decision::after\s*\{[\s\S]*display:\s*none/,
  'The default Load Balance decision surface should not render the dark decorative rings.',
);
assert.match(
  loadBalanceCss,
  /body:is\(\.theme-light, \.theme-high-contrast-light\) #root \.analysis-insight-detail-page\.is-load-balance \.analysis-load-profile-decision \.coach-identity-copy strong[\s\S]*color:\s*#fff8f1\s*!important/,
  'The Load Balance coach identity should remain readable over the track-backed decision surface.',
);

console.log('[PASS] Analysis subpage navigation guard passed.');
