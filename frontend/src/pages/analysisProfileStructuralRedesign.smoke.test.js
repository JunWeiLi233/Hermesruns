import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const srcRoot = path.resolve(here, '..');
const read = (relativePath) => readFileSync(path.join(srcRoot, relativePath), 'utf8');

const pageSource = read('pages/AnalysisInsightDetail.jsx');
const profileSource = read('pages/ProfileDashboard.jsx');
const styleSource = read('styles/analysis-profile-visual-alignment.css');
const indexSource = read('index.css');

const sliceBranch = (startMarker, endMarker) => {
  const start = pageSource.indexOf(startMarker);
  const end = pageSource.indexOf(endMarker, start);
  assert.ok(start >= 0 && end > start, `Unable to isolate ${startMarker}.`);
  return pageSource.slice(start, end);
};

const coachBranch = sliceBranch(
  "insightKey === 'coach-insight' && coachSystem ? (",
  ") : insightKey === 'injury-risk' ? (",
);
const injuryBranch = sliceBranch(
  ") : insightKey === 'injury-risk' ? (",
  ") : insightKey === 'load-balance' && loadDashboard ? (",
);
const loadBranch = sliceBranch(
  ") : insightKey === 'load-balance' && loadDashboard ? (",
  ") : insightKey === 'intensity' && intensityDashboard ? (",
);

for (const marker of ['hd-hero', 'hd-today-card', 'hd-metric-strip', 'hd-training-grid']) {
  assert.ok(profileSource.includes(marker), `Profile must remain the structural authority for ${marker}.`);
}

for (const [route, branch] of [
  ['coach', coachBranch],
  ['injury', injuryBranch],
  ['load', loadBranch],
]) {
  assert.ok(branch.includes(`analysis-profile-v2--${route}`), `${route} must use its shared Profile v2 route marker.`);
  const requiredMarkers = [
    'analysis-profile-v2-focus',
    ...(route === 'coach' ? [] : ['analysis-profile-v2-metric-strip']),
  ];
  if (route === 'coach') requiredMarkers.push('analysis-profile-v2-header');
  for (const marker of requiredMarkers) {
    assert.ok(branch.includes(marker), `${route} must include ${marker}.`);
  }
}

assert.doesNotMatch(
  coachBranch,
  /analysis-coach-profile-back|navigate\('\/analysis'\)/,
  'Coach Insight must not restore the removed back-to-analysis control.',
);
assert.doesNotMatch(
  injuryBranch,
  /analysis-vo2-page-back|navigate\('\/analysis'\)/,
  'Injury Risk must not retain a back-to-analysis control when matching Profile.',
);

for (const [route, branch, behaviorMarkers] of [
  ['coach', coachBranch, [
    'analysis-coach-command-chart-shell',
    'analysis-coach-command-session-list',
    'analysis-coach-command-primary-plan',
    'navigate(buildRunDetailPath(row.id))',
    "navigate('/today-run')",
  ]],
  ['injury', injuryBranch, [
    'analysis-cinematic-card--trend',
    'analysis-cinematic-sample-list',
    'onPointerMove={handleInjuryPointerMove}',
    'onPointerLeave={handleInjuryPointerLeave}',
    "navigate('/analysis/vo2max')",
    "navigate('/analysis/intensity')",
    "navigate('/prediction/marathon')",
    "navigate('/runs')",
  ]],
  ['load', loadBranch, [
    'onPointerMove={handleLoadPointerMove}',
    'onPointerLeave={handleLoadPointerLeave}',
    'analysis-load-command-sample-list',
    "navigate('/today-run')",
    "navigate('/runs')",
  ]],
]) {
  for (const behaviorMarker of behaviorMarkers) {
    assert.ok(branch.includes(behaviorMarker), `${route} must preserve route-local behavior ${behaviorMarker}.`);
  }
}

assert.doesNotMatch(
  loadBranch,
  /analysis-load-profile-methodology|analysis-load-command-methodology-card/,
  'Load Balance must not render the removed ACWR methodology grid.',
);

for (const marker of [
  '--analysis-v2-paper:',
  '--analysis-v2-card:',
  '.analysis-profile-v2-header',
  '.analysis-profile-v2-focus',
  '.analysis-profile-v2-metric-strip',
  '.analysis-profile-v2-evidence-grid',
  'theme-midnight',
  'theme-high-contrast',
  'max-width: 760px',
  'prefers-reduced-motion: reduce',
]) {
  assert.ok(styleSource.includes(marker), `Structural alignment stylesheet is missing ${marker}.`);
}

assert.doesNotMatch(
  styleSource,
  /var\(--analysis-v2-line\)/,
  'Profile-v2 styles must not reference the undefined --analysis-v2-line token.',
);

const loadImport = indexSource.indexOf("@import './styles/analysis-load-balance-profile-alignment.css';");
const structuralImport = indexSource.indexOf("@import './styles/analysis-profile-visual-alignment.css';");
assert.ok(structuralImport > loadImport, 'The structural Profile layer must remain after route-local legacy alignment CSS.');

const desktopAuthorityStart = styleSource.indexOf('@media (min-width: 961px)');
const tabletAuthorityStart = styleSource.indexOf('@media (max-width: 960px)');
const compactAuthorityStart = styleSource.indexOf('@media (max-width: 760px)', tabletAuthorityStart);
const reducedMotionStart = styleSource.indexOf('@media (prefers-reduced-motion: reduce)', compactAuthorityStart);
const cascadeFailures = [];
const requireCascade = (condition, message) => {
  if (!condition) cascadeFailures.push(message);
};

requireCascade(desktopAuthorityStart >= 0, 'v2 must define an explicit >960px desktop authority block');
requireCascade(
  desktopAuthorityStart >= 0 && desktopAuthorityStart < tabletAuthorityStart,
  'v2 desktop authority must precede the <=960px collapse',
);

const desktopAuthority = desktopAuthorityStart >= 0
  ? styleSource.slice(desktopAuthorityStart, tabletAuthorityStart)
  : '';
const tabletAuthority = styleSource.slice(tabletAuthorityStart, compactAuthorityStart);
const compactAuthority = styleSource.slice(compactAuthorityStart, reducedMotionStart);
const coachWorkbenchSelector = 'body #root .analysis-insight-detail-page.is-coach-insight .analysis-profile-v2--coach .analysis-coach-profile-workbench';
const loadEvidenceSelector = 'body #root .analysis-insight-detail-page.is-load-balance .analysis-profile-v2--load .analysis-load-profile-evidence';
const coachDialSelector = 'body #root .analysis-insight-detail-page.is-coach-insight .analysis-profile-v2--coach .analysis-coach-profile-readiness-dial';
const loadDialSelector = 'body #root .analysis-insight-detail-page.is-load-balance .analysis-profile-v2--load .analysis-load-profile-ring';

requireCascade(
  desktopAuthority.includes(coachWorkbenchSelector) && /grid-template-columns:\s*minmax\(0,\s*1\.55fr\)\s+minmax\(290px,\s*0\.75fr\)/.test(desktopAuthority),
  'v2 must override the legacy 1180px coach stack above 960px with a route-scoped desktop grid',
);
requireCascade(
  desktopAuthority.includes(loadEvidenceSelector) && /grid-template-columns:\s*minmax\(0,\s*1\.6fr\)\s+minmax\(270px,\s*0\.6fr\)/.test(desktopAuthority),
  'v2 must override the legacy 1180px load stack above 960px with a route-scoped desktop grid',
);
requireCascade(
  tabletAuthority.includes(coachWorkbenchSelector) && tabletAuthority.includes(loadEvidenceSelector),
  'v2 <=960px collapse selectors must be route-scoped and more specific than legacy breakpoints',
);
requireCascade(
  compactAuthority.includes(coachDialSelector) && compactAuthority.includes(loadDialSelector),
  'v2 <=760px dial sizing must be route-scoped and more specific than legacy compact rules',
);
requireCascade(
  /width:\s*68px;[\s\S]*height:\s*68px;/.test(compactAuthority),
  'v2 <=760px status/readiness dials must retain the compact 68px treatment',
);

assert.equal(
  cascadeFailures.length,
  0,
  `Profile-v2 responsive cascade regressions:\n${cascadeFailures.join('\n')}`,
);

console.log('[PASS] Analysis routes use the Profile structural hierarchy.');
