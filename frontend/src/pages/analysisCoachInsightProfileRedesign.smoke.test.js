import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const source = fs.readFileSync(path.join(here, 'AnalysisInsightDetail.jsx'), 'utf8');
const styles = fs.readFileSync(path.join(here, '../styles/_split/analysis.css'), 'utf8');
const visualStyles = fs.readFileSync(path.join(here, '../styles/analysis-profile-visual-alignment.css'), 'utf8');

const branchStart = source.indexOf("{insightKey === 'coach-insight' && coachSystem ? (");
const branchEnd = source.indexOf(") : insightKey === 'injury-risk' ? (", branchStart);

assert.ok(branchStart >= 0 && branchEnd > branchStart, 'coach insight branch should remain addressable');

const coachBranch = source.slice(branchStart, branchEnd);

[
  'analysis-coach-profile',
  'analysis-coach-profile-decision',
  'analysis-coach-profile-workbench',
  'analysis-coach-profile-blueprint',
  'analysis-coach-profile-recent',
  'analysis-coach-profile-evidence',
].forEach((className) => {
  assert.match(coachBranch, new RegExp(className), `coach insight should render ${className}`);
});

[
  'coachSystem.readinessScore',
  'coachSystem.keyWorkout',
  'coachSystem.recentRows',
  'coachPrimarySession',
  'coachSystem.phases',
  'coachSystem.reasons',
].forEach((binding) => {
  assert.match(coachBranch, new RegExp(binding.replaceAll('.', '\\.')), `coach insight should preserve ${binding}`);
});

assert.doesNotMatch(
  coachBranch,
  /analysis-coach-command-gear-card/,
  'Coach Insight should remove the redundant equipment-strategy card from the blueprint sidebar.',
);

assert.doesNotMatch(
  coachBranch,
  /analysis-coach-profile-back|navigate\('\/analysis'\)/,
  'Profile-aligned Coach Insight should not restore a back-to-analysis control.',
);
assert.match(coachBranch, /navigate\(buildRunDetailPath\(row\.id\)\)/, 'recent sessions should still open run detail');
assert.match(coachBranch, /navigate\('\/today-run'\)/, 'blueprint CTA should still open Today Run');
assert.doesNotMatch(
  coachBranch,
  /coachSecondarySessions\.map|analysis-coach-command-secondary-plan/,
  'Today\'s Training Plan should render only the primary today session, not the rest of the week.',
);
assert.doesNotMatch(
  coachBranch,
  /<section className="analysis-coach-command-hero"/,
  'legacy command-center hero shell should be replaced',
);
assert.doesNotMatch(
  coachBranch,
  /analysis-coach-command-live-pill|analysis-coach-command-cycle-pill/,
  'Coach Insight should not render the two redundant hero status pills',
);
assert.doesNotMatch(
  coachBranch,
  /analysis-coach-profile-metrics|analysis-profile-v2-metric-strip/,
  'Coach Insight should not render the redundant forecast metric strip',
);
assert.match(
  visualStyles,
  /body #root \.analysis-insight-detail-page\.is-coach-insight \.analysis-profile-v2--coach \.analysis-coach-profile-metrics\s*\{[\s\S]*display:\s*none\s*!important;/,
  'Coach Insight should hide the removed metric strip even when an older cached chunk leaves its legacy markup mounted',
);
assert.doesNotMatch(
  coachBranch,
  /coachSystem\.statCards|analysis-coach-command-stat-row|analysis-coach-command-stat-tile/,
  'Coach Insight should not render the redundant forecast stat cards inside the performance panel',
);
assert.doesNotMatch(
  coachBranch,
  /analysis-coach-command-performance-copy/,
  'Coach Insight should not render the redundant phase title and description above the ACWR chart',
);
assert.match(
  coachBranch,
  /analysis-coach-command-phase-card[\s\S]*analysis-coach-command-phase-row/,
  'the Coach Insight phase grid should have a dedicated surface scope',
);
assert.match(
  coachBranch,
  /analysis-coach-command-support-card--schedule[\s\S]*analysis-coach-command-focus-grid/,
  'the Coach Insight training-planning grid should have a dedicated surface scope',
);

const styleStart = styles.indexOf('/* Coach insight Profile-aligned redesign */');
assert.ok(styleStart >= 0, 'coach insight redesign styles should have an explicit section marker');

const coachStyles = styles.slice(styleStart);
assert.match(
  coachStyles,
  /\.analysis-insight-detail-page\.is-coach-insight\s+\.analysis-coach-profile/,
  'coach insight tokens should be scoped to the route',
);
const currentHeroIndex = styles.indexOf(
  '.analysis-insight-detail-page.is-coach-insight .analysis-coach-command-hero-copy {',
  styleStart,
);
assert.ok(currentHeroIndex >= 0, 'coach insight should have a current hero surface rule');
const lightSurfaceStart = styles.indexOf('/* Keep the current coach-insight hero readable as a Profile surface. */');
assert.ok(lightSurfaceStart > currentHeroIndex, 'coach insight light surface override should follow the dark base rule');
assert.match(
  styles.slice(lightSurfaceStart, lightSurfaceStart + 700),
  /background:[\s\S]*#fffdf9/,
  'coach insight hero should use the white Profile surface instead of the dark grid',
);
assert.match(coachStyles, /@media\s*\(max-width:\s*1180px\)/, 'workbench should stack on smaller desktops');
assert.match(
  coachStyles,
  /\.analysis-insight-detail-page\.is-coach-insight\s+\.analysis-coach-profile-workbench\s*\{[\s\S]*--coach-profile-top-row-height:\s*clamp\(380px,\s*30vw,\s*454px\);/,
  'desktop coach workbench should define one shared top-row height for aligned cards',
);
assert.match(
  coachStyles,
  /\.analysis-insight-detail-page\.is-coach-insight\s+\.analysis-coach-command-performance-card,\s*\.analysis-insight-detail-page\.is-coach-insight\s+\.analysis-coach-command-primary-plan\s*\{[^}]*\n\s+height:\s*var\(--coach-profile-top-row-height\);/,
  'performance and primary plan cards should share the same desktop grid row height',
);
assert.match(
  coachStyles,
  /\.analysis-insight-detail-page\.is-coach-insight\s+\.analysis-coach-profile-workbench\s*\{[^}]*\n\s+align-items:\s*stretch;/,
  'desktop coach workbench columns should stretch to the tallest plan stack',
);
assert.match(
  coachStyles,
  /\.analysis-insight-detail-page\.is-coach-insight\s+\.analysis-coach-profile-main\s*\{[^}]*\n\s+grid-template-rows:\s*auto\s+var\(--coach-profile-top-row-height\)\s+minmax\(0,\s*1fr\);/,
  'left coach column should reserve the top row and use the remaining track for recent training',
);
assert.match(
  coachStyles,
  /\.analysis-insight-detail-page\.is-coach-insight\s+\.analysis-coach-profile-recent\s*\{[^}]*\n\s+height:\s*100%;/,
  'recent training should fill the remaining left column track',
);
assert.match(coachStyles, /@media\s*\(max-width:\s*760px\)/, 'metrics and evidence should stack on mobile');
assert.match(coachStyles, /@media\s*\(max-width:\s*640px\)/, 'session rows and actions should compact on narrow screens');
assert.match(coachStyles, /:focus-visible/, 'interactive controls should retain visible keyboard focus');
assert.match(
  visualStyles,
  /body #root \.analysis-insight-detail-page\.is-coach-insight \.analysis-profile-v2--coach \.analysis-profile-v2-focus-title\s*\{[\s\S]*color:\s*#fff\s*!important;/,
  'the visible coach decision title should stay white on the dark decision surface',
);
assert.match(
  visualStyles,
  /body #root \.analysis-insight-detail-page\.is-coach-insight \.analysis-profile-v2--coach \.analysis-coach-command-session-row\s*\{[\s\S]*border:\s*0\s*!important;[\s\S]*background:\s*#f1f2f2\s*!important;[\s\S]*box-shadow:\s*none\s*!important;/,
  'the Coach Insight recent-run grids should use the same light-grey fill without borders or shadows as the preparation tile',
);
assert.match(
  visualStyles,
  /body #root \.analysis-insight-detail-page\.is-coach-insight \.analysis-profile-v2--coach \.analysis-coach-profile-decision \.analysis-coach-profile-coach \.coach-identity-copy\s*\{[\s\S]*display:\s*flex;[\s\S]*align-items:\s*baseline;[\s\S]*gap:/,
  'the Coach Insight name and role should share one horizontal line',
);
assert.match(
  coachBranch,
  /<div className="analysis-coach-profile-coach-stack">[\s\S]*<CoachIdentityBadge[\s\S]*<span className="analysis-profile-v2-focus-kicker">/,
  'the Coach Insight kicker should be grouped with the coach identity stack',
);
assert.match(
  visualStyles,
  /body #root \.analysis-insight-detail-page\.is-coach-insight \.analysis-profile-v2--coach \.analysis-coach-profile-coach-stack\s*\{[\s\S]*display:\s*grid;[\s\S]*gap:/,
  'the Coach Insight identity stack should place the kicker below the badge',
);
assert.match(
  visualStyles,
  /body #root \.analysis-insight-detail-page\.is-coach-insight \.analysis-profile-v2--coach \.analysis-coach-profile-coach-stack \.analysis-profile-v2-focus-kicker\s*\{[\s\S]*margin-left:\s*calc\(44px \+ 12px\);/,
  'the Coach Insight kicker should align with the name copy instead of the avatar',
);
assert.match(
  visualStyles,
  /body #root \.analysis-insight-detail-page\.is-coach-insight \.analysis-profile-v2--coach \.analysis-coach-command-performance-body\s*\{[\s\S]*grid-template-columns:\s*minmax\(0,\s*1fr\);/,
  'the Coach Insight ACWR chart should use the full performance-card width after removing the copy block',
);
assert.match(
  visualStyles,
  /body #root \.analysis-insight-detail-page\.is-coach-insight \.analysis-profile-v2--coach \.analysis-coach-command-performance-copy\s*\{[\s\S]*display:\s*none\s*!important;/,
  'stale Coach Insight chunks should not remount the removed performance copy block',
);
assert.match(
  visualStyles,
  /body #root \.analysis-insight-detail-page\.is-coach-insight \.analysis-profile-v2--coach \.analysis-coach-command-phase-card\s*\{[\s\S]*background:\s*var\(--analysis-v2-card\)\s*!important;/,
  'the Coach Insight phase grid should not inherit the themed panel strip',
);
assert.match(
  visualStyles,
  /body #root \.analysis-insight-detail-page\.is-coach-insight \.analysis-profile-v2--coach \.analysis-coach-command-phase-card \.analysis-coach-command-panel-head\s*\{[\s\S]*background:\s*transparent\s*!important;/,
  'the phase grid panel header should remain transparent',
);
assert.match(
  visualStyles,
  /body #root \.analysis-insight-detail-page\.is-coach-insight \.analysis-profile-v2--coach \.analysis-coach-command-phase-card \.analysis-coach-command-phase-chip\s*\{[\s\S]*border:\s*0\s*!important;[\s\S]*background:\s*#f1f2f2\s*!important;/,
  'the Coach Insight phase grids should use a light-grey fill without borders',
);
assert.match(
  visualStyles,
  /body #root \.analysis-insight-detail-page\.is-coach-insight \.analysis-profile-v2--coach \.analysis-coach-command-reason-list p\s*\{[\s\S]*border:\s*0\s*!important;[\s\S]*background:\s*#f1f2f2\s*!important;/,
  'the Coach Insight evidence rows should use a light-grey fill without borders',
);
assert.match(
  visualStyles,
  /body #root \.analysis-insight-detail-page\.is-coach-insight \.analysis-profile-v2--coach \.analysis-coach-command-support-card--reasons\s*\{[\s\S]*background:\s*var\(--analysis-v2-card\)\s*!important;/,
  'the Coach Insight reasons card should retain its background surface',
);
assert.match(
  visualStyles,
  /body #root \.analysis-insight-detail-page\.is-coach-insight \.analysis-profile-v2--coach \.analysis-coach-command-support-card--reasons \.analysis-coach-command-panel-head\s*\{[\s\S]*background:\s*transparent\s*!important;[\s\S]*border:\s*0\s*!important;/,
  'the Coach Insight reasons title panel should be transparent without removing the card background',
);
assert.match(
  visualStyles,
  /body #root \.analysis-insight-detail-page\.is-coach-insight \.analysis-profile-v2--coach \.analysis-coach-command-support-card--reasons \.analysis-coach-command-reason-list\s*\{[\s\S]*grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\);/,
  'the Coach Insight reasons should use the same two-column tile layout as the training-planning grid',
);
assert.match(
  visualStyles,
  /body #root \.analysis-insight-detail-page\.is-coach-insight \.analysis-profile-v2--coach \.analysis-coach-command-support-card--reasons \.analysis-coach-command-reason-list p\s*\{[\s\S]*padding:\s*12px 12px 12px 30px\s*!important;[\s\S]*border-radius:\s*12px\s*!important;[\s\S]*border:\s*0\s*!important;[\s\S]*background:\s*#f1f2f2\s*!important;[\s\S]*box-shadow:\s*none\s*!important;/,
  'the Coach Insight reasons should use the same gray rounded tile treatment as the training-planning grid',
);
assert.match(
  visualStyles,
  /body #root \.analysis-insight-detail-page\.is-coach-insight \.analysis-profile-v2--coach \.analysis-coach-command-support-card--reasons \.analysis-coach-command-reason-list p::before\s*\{[\s\S]*left:\s*12px\s*!important;/,
  'the Coach Insight reason numbers should have an inset from the tile edge',
);
assert.match(
  visualStyles,
  /body #root \.analysis-insight-detail-page\.is-coach-insight \.analysis-profile-v2--coach \.analysis-coach-command-support-card--schedule \.analysis-coach-command-focus-tile\s*\{[\s\S]*border:\s*0\s*!important;[\s\S]*background:\s*#f1f2f2\s*!important;[\s\S]*box-shadow:\s*none\s*!important;/,
  'the Coach Insight training-planning grid tiles should use the same light-grey layer as the phase grid',
);
assert.match(
  visualStyles,
  /body #root \.analysis-insight-detail-page\.is-coach-insight \.analysis-profile-v2--coach \.analysis-coach-command-support-card--schedule\s*\{[\s\S]*padding:\s*22px\s*!important;[\s\S]*border:\s*0\s*!important;[\s\S]*border-radius:\s*16px\s*!important;[\s\S]*background:\s*var\(--analysis-v2-card\)\s*!important;[\s\S]*box-shadow:\s*var\(--analysis-v2-shadow-md\)\s*!important;/,
  'the Coach Insight training-planning grid should use the same rounded white panel layer as the phase grid',
);

const primaryPlanSurfaceStart = visualStyles.indexOf(
  '/* Keep Coach Insight primary plan aligned with neighboring cards. */',
);
assert.ok(primaryPlanSurfaceStart >= 0, 'Coach Insight primary plan should have a dedicated neutral surface override');
const primaryPlanSurfaceStyles = visualStyles.slice(primaryPlanSurfaceStart, primaryPlanSurfaceStart + 5200);
assert.match(
  primaryPlanSurfaceStyles,
  /body:not\(\.theme-midnight\):not\(\.theme-high-contrast\) #root \.analysis-insight-detail-page\.is-coach-insight \.analysis-profile-v2--coach \.analysis-coach-command-primary-plan\s*\{[\s\S]*background:\s*var\(--analysis-v2-card\)\s*!important;[\s\S]*border:\s*1px solid rgba\(28,\s*25,\s*23,\s*0\.1\)\s*!important;[\s\S]*color:\s*var\(--analysis-v2-ink\)\s*!important;/,
  'the light Coach Insight primary plan should use the same neutral card surface and dark ink as neighboring cards',
);
assert.match(
  primaryPlanSurfaceStyles,
  /body:not\(\.theme-midnight\):not\(\.theme-high-contrast\) #root \.analysis-insight-detail-page\.is-coach-insight \.analysis-profile-v2--coach \.analysis-coach-command-why-card\s*\{[\s\S]*border:\s*0\s*!important;[\s\S]*background:\s*var\(--analysis-v2-coral-soft\)\s*!important;/,
  'the Coach Insight rationale block should use the soft-coral fill without an accent line',
);
assert.doesNotMatch(
  primaryPlanSurfaceStyles,
  /border-left:\s*3px solid var\(--analysis-v2-coral\)/,
  'the neutral Coach Insight card treatment should not reintroduce a coral left border',
);
assert.match(
  primaryPlanSurfaceStyles,
  /analysis-coach-command-primary-plan\s+:is\([\s\S]*color:\s*var\(--analysis-v2-ink\)\s*!important;/,
  'all primary Coach Insight plan text should resolve to the dark ink token',
);
assert.match(
  primaryPlanSurfaceStyles,
  /body:not\(\.theme-midnight\):not\(\.theme-high-contrast\) #root \.analysis-insight-detail-page\.is-coach-insight \.analysis-profile-v2--coach \.analysis-coach-command-primary-plan\s*\{[\s\S]*height:\s*auto\s*!important;[\s\S]*min-height:\s*0\s*!important;[\s\S]*align-self:\s*start;/,
  'the light Coach Insight primary plan should size to its content instead of showing a large empty lower half',
);

console.log('analysis coach insight Profile redesign smoke test passed');
