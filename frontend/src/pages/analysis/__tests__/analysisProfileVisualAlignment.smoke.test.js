import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const srcRoot = path.resolve(here, "../../..");
const read = (relativePath) => readFileSync(path.join(srcRoot, relativePath), 'utf8');

const insightSource = read('./pages/analysis/AnalysisInsightDetail.jsx');
const profileSource = read('./pages/profile/ProfileDashboard.jsx');
const indexSource = read('./index.css');
const predictionStyles = read('./styles/_split/analysis.css');
const alignmentSource = read('./styles/analysis-profile-visual-alignment.css');

for (const routeMarker of ['is-injury-risk', 'is-coach-insight', 'is-load-balance']) {
  assert.ok(
    new RegExp(`runner-shell-page runner-dashboard-page analysis-insight-detail-page[^\\n]*${routeMarker}\\b`).test(insightSource),
    `AnalysisInsightDetail must attach the ${routeMarker} route marker to analysis-insight-detail-page.`,
  );
  assert.match(
    alignmentSource,
    new RegExp(`\\.analysis-insight-detail-page\\.${routeMarker}\\b`),
    `The shared Profile alignment stylesheet must scope rules to ${routeMarker}.`,
  );
}

for (const profileMarker of [
  'runner-dashboard-page',
  'runner-shell-topbar runner-dashboard-shell-topbar',
  'runner-shell-canvas',
]) {
  assert.ok(profileSource.includes(profileMarker), `Profile must remain the visual authority for ${profileMarker}.`);
}

for (const token of ['--analysis-profile-paper:', '--analysis-profile-card:']) {
  assert.match(alignmentSource, new RegExp(token.replace(':', '\\s*:')), `Missing Profile-derived token ${token}`);
}

assert.match(alignmentSource, /\.runner-shell-canvas\b/, 'The shared alignment must cover the shared Profile canvas.');
assert.match(alignmentSource, /\.runner-shell-topbar\b/, 'The shared alignment must cover the shared Profile topbar.');
assert.match(alignmentSource, /theme-midnight/, 'The shared alignment must preserve the midnight theme contract.');
assert.match(alignmentSource, /theme-high-contrast/, 'The shared alignment must support the high-contrast theme.');
assert.match(alignmentSource, /max-width:\s*960px/, 'The shared alignment must define the Profile content width.');

const predictionCanvasPadding = 'padding-inline: clamp(16px, 2.5vw, 40px) !important;';
assert.match(
  predictionStyles,
  new RegExp(predictionCanvasPadding.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')),
  'Prediction detail must keep its shared horizontal canvas inset as the alignment reference.',
);

const injuryCanvasRule = alignmentSource.match(
  /body #root \.analysis-insight-detail-page\.is-injury-risk \.runner-shell-canvas\.analysis-insight-detail-canvas\s*\{([\s\S]*?)\}/,
);
assert.ok(injuryCanvasRule, 'Injury Risk must keep a route-specific canvas alignment rule.');
assert.match(
  injuryCanvasRule[1],
  new RegExp(predictionCanvasPadding.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')),
  'Injury Risk must use the same horizontal canvas inset as Prediction detail.',
);

const mobileMediaStart = alignmentSource.indexOf('@media (max-width: 760px)');
const reducedMotionStart = alignmentSource.indexOf('@media (prefers-reduced-motion: reduce)');
const mobileAlignment = alignmentSource.slice(mobileMediaStart, reducedMotionStart);
const injuryMobileRule = mobileAlignment.match(
  /body #root \.analysis-insight-detail-page\.is-injury-risk \.runner-shell-canvas\.analysis-insight-detail-canvas\s*\{([\s\S]*?)\}/,
);
assert.ok(
  /padding-inline:\s*16px\s*!important;/.test(injuryMobileRule?.[1] || ''),
  'Injury Risk must keep the same 16px horizontal inset as Prediction detail on mobile.',
);

const loadRingRule = alignmentSource.match(
  /body #root \.analysis-insight-detail-page\.is-load-balance \.analysis-load-profile-ring\s*\{([\s\S]*?)\}/,
);
assert.ok(loadRingRule, 'Load Balance must keep a route-specific circular readiness ring contract.');
assert.match(
  loadRingRule[1],
  /width:\s*68px\s*!important;[\s\S]*height:\s*68px\s*!important;[\s\S]*min-width:\s*68px\s*!important;[\s\S]*min-height:\s*68px\s*!important;[\s\S]*flex:\s*0\s+0\s+68px\s*!important;[\s\S]*aspect-ratio:\s*1\s*\/\s*1;[\s\S]*border-radius:\s*50%\s*!important;/,
  'Load Balance readiness ring must keep equal dimensions and a 1:1 circular shape.',
);

const loadEvidenceHeightRule = alignmentSource.match(
  /body #root \.analysis-insight-detail-page\.is-load-balance \.analysis-load-profile-evidence\s*\{([\s\S]*?)\}/,
);
assert.ok(
  loadEvidenceHeightRule,
  'Load Balance evidence cards must have a route-specific shared-height rule.',
);
assert.match(
  loadEvidenceHeightRule[1],
  /align-items:\s*stretch\s*!important;/,
  'Load Balance chart and ratio cards must stretch to the same grid-row height.',
);

const loadMetricGridRule = alignmentSource.match(
  /@media\s*\(min-width:\s*1181px\)[\s\S]*?body #root \.analysis-insight-detail-page\.is-load-balance \.analysis-profile-v2--load \.analysis-profile-v2-metric-strip\s*\{([\s\S]*?)\}/,
);
assert.ok(loadMetricGridRule, 'Load Balance must have a desktop metric-grid layout rule.');
assert.match(
  loadMetricGridRule[1],
  /grid-template-columns:\s*repeat\(4,\s*minmax\(0,\s*1fr\)\);/,
  'Load Balance must keep all four metric cards on one desktop row.',
);

const loadFocusTitleRule = alignmentSource.match(
  /body #root \.analysis-profile-v2--load \.analysis-profile-v2-focus h2\s*\{([\s\S]*?)\}/,
);
assert.ok(loadFocusTitleRule, 'Load Balance focus title must have a final route-scoped readability rule.');
assert.match(
  loadFocusTitleRule[1],
  /color:\s*#fff8f1\s*!important;/,
  'Load Balance coach decision title must remain white after Profile heading styles are applied.',
);
assert.match(
  alignmentSource,
  /@media\s*\(prefers-reduced-motion:\s*reduce\)/,
  'The shared alignment must respect reduced-motion preferences.',
);

const loadAlignmentImport = indexSource.indexOf("@import './styles/analysis-load-balance-profile-alignment.css';");
const profileAlignmentImport = indexSource.indexOf("@import './styles/analysis-profile-visual-alignment.css';");
assert.ok(loadAlignmentImport >= 0, 'The existing Load Balance Profile alignment import must remain present.');
assert.ok(
  profileAlignmentImport > loadAlignmentImport,
  'The shared Profile visual alignment stylesheet must load after the Load Balance Profile alignment stylesheet.',
);

for (const behaviorMarker of [
  'analysis-coach-profile',
  'coachSystem.title',
  'analysis-coach-command-primary-plan',
  'analysis-cinematic-sample-list',
  'analysis-cinematic-card--trend',
  'injuryTrend.primaryPath',
  'analysis-load-command-chart-card',
  'analysis-load-command-sample-list',
]) {
  assert.ok(insightSource.includes(behaviorMarker), `Existing analysis behavior marker ${behaviorMarker} must remain.`);
}

assert.doesNotMatch(
  insightSource,
  /analysis-load-profile-methodology|analysis-load-command-methodology-card/,
  'Load Balance must not render the removed ACWR methodology grid.',
);

console.log('[PASS] Analysis Profile visual-alignment contract passed.');
