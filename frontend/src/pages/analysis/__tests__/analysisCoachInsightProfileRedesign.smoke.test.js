import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const source = fs.readFileSync(path.join(here, "../AnalysisInsightDetail.jsx"), 'utf8');
const styles = fs.readFileSync(path.join(here, "../../../styles/analysis-coach-bento.css"), 'utf8');
const visualStyles = fs.readFileSync(path.join(here, "../../../styles/analysis-profile-visual-alignment.css"), 'utf8');

const branchStart = source.indexOf("{insightKey === 'coach-insight' && coachSystem ? (");
const branchEnd = source.indexOf(") : insightKey === 'injury-risk' ? (", branchStart);

assert.ok(branchStart >= 0 && branchEnd > branchStart, 'coach insight branch should remain addressable');

const coachBranch = source.slice(branchStart, branchEnd);

[
  'analysis-coach-profile',
  'analysis-coach-bento__verdict',
  'analysis-coach-bento__load',
  'analysis-coach-bento__today',
  'analysis-coach-bento__signals',
  'analysis-coach-bento__recent',
  'analysis-coach-bento__phase',
  'analysis-coach-bento__reasons',
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
  'coachSystem.focusCards',
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
  /analysis-coach-bento__phase[\s\S]*analysis-coach-bento__phase-track/,
  'the Coach Insight phase grid should have a dedicated surface scope',
);
assert.match(
  coachBranch,
  /analysis-coach-bento__signals[\s\S]*coachSystem\.focusCards\.map[\s\S]*analysis-coach-bento__signal/,
  'the Coach Insight training-planning grid should have a dedicated surface scope',
);

// Assert the live bento surfaces; legacy Profile selectors remain only for
// cached-chunk removal guards above and below.
const rule = (selector) => {
  const block = styles.match(new RegExp(selector.replaceAll('.', '\\.') + '\\s*\\{([^}]*)\\}'));
  assert.ok(block, 'Coach Insight should style ' + selector);
  return block[1];
};

const rootStyles = rule('#root .analysis-insight-detail-page.is-coach-insight .analysis-coach-bento');
assert.match(rootStyles, /--bento-card:\s*var\(--analysis-v2-card,\s*#fff\);/, 'coach tiles should retain the shared Profile card token');
assert.match(rootStyles, /--bento-ink:\s*var\(--analysis-v2-ink,\s*#1c1917\);/, 'coach tiles should retain the shared Profile ink token');
assert.match(rootStyles, /display:\s*grid;[\s\S]*grid-template-columns:\s*repeat\(12,\s*minmax\(0,\s*1fr\)\);/, 'coach desktop layout should align tiles on a shared twelve-column grid');
assert.match(rootStyles, /gap:\s*16px;/, 'coach tiles should retain space between their surfaces');

const runtimeStyles = fs.readFileSync(path.join(here, "../../../styles/app.css"), 'utf8');
const bentoImport = runtimeStyles.indexOf("@import './analysis-coach-bento.css';");
assert.ok(bentoImport > runtimeStyles.indexOf("@import './analysis-profile-visual-alignment.css';"), 'live bento rules should load after the legacy Profile alignment layer');
assert.ok(bentoImport < runtimeStyles.indexOf("@import './dark-mode-final-fixes.css';"), 'final theme fixes should retain cascade authority');

assert.match(styles, /#root \.analysis-coach-bento > section,\s*#root \.analysis-coach-bento__signal\s*\{[^}]*padding:\s*22px 24px;[^}]*border:\s*0;[^}]*border-radius:\s*22px;[^}]*background:\s*var\(--bento-card\);[^}]*box-shadow:\s*none;/, 'coach phase, reasons, recent, and signal tiles should retain padded neutral surfaces');

const verdictStyles = rule('#root .analysis-coach-bento__verdict');
assert.match(verdictStyles, /grid-column:\s*span 8;/, 'decision should occupy the wide desktop tile');
assert.match(verdictStyles, /grid-template-columns:\s*minmax\(0,\s*1fr\)\s+180px;/, 'decision and readiness should retain separate desktop columns');
assert.match(rule('#root .analysis-coach-bento__verdict h1'), /color:\s*var\(--bento-ink\)\s*!important;/, 'decision text should remain readable on its neutral surface');
assert.match(rule('#root .analysis-coach-bento__verdict p'), /color:\s*var\(--bento-muted\)\s*!important;/, 'decision explanation should retain readable muted text');
assert.match(coachBranch, /analysis-coach-bento__verdict-copy[\s\S]*?<CoachIdentityBadge coach=\{assignedCoach\} lang=\{lang\}[\s\S]*?<span className="analysis-coach-bento__kicker">/, 'the decision should retain assigned coach identity above its kicker');
assert.match(rule('#root .analysis-coach-bento__verdict-copy'), /display:\s*flex;[^}]*flex-direction:\s*column;[^}]*gap:\s*10px;/, 'coach identity, kicker, and decision should retain vertical spacing');

const todayStyles = rule('#root .analysis-coach-bento__today');
assert.match(todayStyles, /grid-column:\s*span 4;[\s\S]*grid-row:\s*span 2;/, 'today should retain the tall desktop tile beside the decision and signals');
assert.match(todayStyles, /display:\s*flex;[\s\S]*flex-direction:\s*column;[\s\S]*gap:\s*14px;/, 'today plan should space its content vertically');
assert.match(todayStyles, /background:\s*var\(--bento-dark\)\s*!important;[\s\S]*color:\s*var\(--bento-dark-ink\);/, 'today plan should retain its dark surface and readable light ink');
assert.doesNotMatch(todayStyles, /(?:height|min-height):/, 'today plan should size with its content and grid track rather than a fixed empty card height');
assert.match(rule('#root .analysis-insight-detail-page.is-coach-insight .analysis-coach-bento .analysis-coach-bento__today h2'), /color:\s*var\(--bento-dark-ink\)\s*!important;/, 'today title should remain readable after shared heading rules');
assert.match(rule('#root .analysis-coach-bento__session'), /grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\);/, 'target and pace should retain two columns');
assert.match(rule('#root .analysis-coach-bento__session dd'), /color:\s*var\(--bento-dark-ink\);/, 'today session values should retain light ink');
assert.match(rule('#root .analysis-coach-bento__why'), /padding:\s*14px;[\s\S]*border-radius:\s*14px;[\s\S]*background:\s*rgba\(255,\s*255,\s*255,\s*0\.06\);/, 'rationale should retain its inset rounded surface');
assert.doesNotMatch(rule('#root .analysis-coach-bento__why'), /border-left:/, 'rationale should not reintroduce an accent border');
assert.match(rule('#root .analysis-coach-bento__why p'), /color:\s*#e8e1d8\s*!important;/, 'rationale should retain readable light text');
assert.match(rule('#root .analysis-coach-bento__cta'), /margin-top:\s*auto;[\s\S]*min-height:\s*46px;/, 'today action should remain reachable at the bottom of the plan');

const signalStyles = rule('#root .analysis-coach-bento__signals');
assert.match(signalStyles, /grid-column:\s*span 8;[\s\S]*grid-template-columns:\s*repeat\(3,\s*minmax\(0,\s*1fr\)\);/, 'training signals should retain their dedicated desktop grid');
assert.match(coachBranch, /coachSystem\.focusCards\.map[\s\S]*?\{card\.label\}[\s\S]*?\{card\.value\}[\s\S]*?\{card\.detail\}/, 'every training signal should retain its label, value, and detail');

assert.match(rule('#root .analysis-coach-bento__load'), /grid-column:\s*span 8;/, 'load evidence should retain the wide chart tile');
const chart = fs.readFileSync(path.join(here, '../CoachLoadChart.jsx'), 'utf8');
assert.match(rule('#root .analysis-coach-bento .coach-load-chart__plot'), /position:\s*relative;[\s\S]*width:\s*100%;/, 'The load chart should fit its measured tile width.');
assert.match(coachBranch, /<CoachLoadChart key=\{coachPerformanceWindow\} dashboard=\{coachLoadDashboard\}/, 'The route should supply the selected load window to the chart.');
assert.match(chart, /onPointerMove=\{selectPoint\}/, 'The load chart should retain interactive pointer tracking.');
assert.match(chart, /onPointerLeave=/, 'The load chart should retain pointer reset.');
assert.match(chart, /data-analysis-history="coach"[\s\S]*?dashboard\.chartWindow\.map/, 'The load chart should retain its accessible data history.');
assert.match(visualStyles, /body #root \.analysis-insight-detail-page\.is-coach-insight \.analysis-profile-v2--coach \.analysis-coach-command-performance-copy\s*\{[\s\S]*display:\s*none\s*!important;/, 'cached legacy chunks should not remount the removed performance copy block');

assert.match(rule('#root .analysis-coach-bento__recent'), /grid-column:\s*span 4;[\s\S]*gap:\s*6px;/, 'recent training should retain its adjacent desktop tile and title spacing');
assert.match(rule('#root .analysis-coach-bento__recent-list'), /display:\s*flex;[^}]*flex-direction:\s*column;/, 'recent sessions should retain a vertical list');
assert.match(rule('#root .analysis-coach-bento__recent-row'), /grid-template-columns:\s*8px\s+minmax\(0,\s*1fr\)\s+auto;[\s\S]*gap:\s*12px;[\s\S]*padding:\s*10px 0;[\s\S]*border:\s*0;[\s\S]*border-top:\s*1px solid var\(--bento-line\);[\s\S]*background:\s*none;/, 'recent rows should retain spaced data columns and light separators without a nested panel strip');

assert.match(rule('#root .analysis-coach-bento__reasons'), /grid-column:\s*span 6;[\s\S]*gap:\s*14px;/, 'phase and reasons should share half-width desktop tiles with title spacing');
assert.match(rule('#root .analysis-coach-bento__phase-track'), /display:\s*grid;[^}]*grid-auto-flow:\s*column;[^}]*grid-auto-columns:\s*1fr;[^}]*gap:\s*6px;/, 'phase progression should retain aligned steps');
assert.match(coachBranch, /coachSystem\.phases\.map[\s\S]*?aria-current=\{phase\.active \? 'step' : undefined\}[\s\S]*?phase\.active && 'is-active'[\s\S]*?\{phase\.label\}/, 'phase progression should retain active state and accessible labels');
assert.match(rule('#root .analysis-coach-bento__phase-step.is-active i'), /background:\s*var\(--bento-accent\);/, 'current phase should retain its visible accent');
assert.match(rule('#root .analysis-coach-bento__phase-step.is-active strong'), /color:\s*var\(--bento-ink\);/, 'current phase label should retain readable ink');
assert.match(rule('#root .analysis-coach-bento__reasons ol'), /gap:\s*10px;[\s\S]*counter-reset:\s*reason;/, 'reasons should retain spacing and ordered numbering');
assert.match(rule('#root .analysis-coach-bento__reasons li'), /gap:\s*10px;[\s\S]*color:\s*var\(--bento-ink\);[\s\S]*counter-increment:\s*reason;/, 'each evidence point should retain readable text and its number');
assert.match(rule('#root .analysis-coach-bento__reasons li::before'), /content:\s*counter\(reason\);[\s\S]*flex:\s*0 0 20px;[\s\S]*background:\s*var\(--bento-accent-soft\);/, 'evidence numbers should retain inset space and an accent surface');

const tabletStart = styles.indexOf('@media (max-width: 1180px)');
const compactStart = styles.indexOf('@media (max-width: 860px)');
const narrowStart = styles.indexOf('@media (max-width: 640px)');
assert.ok(tabletStart >= 0 && compactStart > tabletStart && narrowStart > compactStart, 'coach responsive overrides should retain their tablet, compact, and narrow order');
const tabletStyles = styles.slice(tabletStart, compactStart);
const compactStyles = styles.slice(compactStart, narrowStart);
const narrowStyles = styles.slice(narrowStart);
assert.match(tabletStyles, /analysis-coach-bento__load\s*\{\s*grid-column:\s*1 \/ -1;/, 'wide evidence tiles should span the tablet grid');
assert.match(tabletStyles, /analysis-coach-bento__recent\s*\{\s*grid-column:\s*1 \/ -1;\s*grid-row:\s*auto;/, 'today and recent tiles should release their desktop rows on tablet');
assert.match(compactStyles, /analysis-coach-bento__reasons\s*\{\s*grid-column:\s*1 \/ -1\s*!important;/, 'all coach tiles should stack on compact screens');
assert.match(compactStyles, /analysis-coach-bento__verdict\s*\{\s*grid-template-columns:\s*minmax\(0,\s*1fr\);/, 'decision copy and readiness should stack on compact screens');
assert.match(compactStyles, /analysis-coach-bento__signals\s*\{\s*grid-template-columns:\s*minmax\(0,\s*1fr\);/, 'training signals should stack on compact screens');
assert.match(narrowStyles, /analysis-coach-bento__load\s*\{\s*padding:\s*20px 16px;/, 'Narrow chart tiles should retain usable side padding.');
assert.match(styles, /coach-load-chart__plot svg\s*\{[^}]*width:\s*100%;[^}]*height:\s*auto;/, 'The complete chart should fit narrow screens.');
assert.match(styles, /coach-load-chart__plot svg text\s*\{[^}]*font:\s*11px/, 'Chart labels should keep their native readable size.');
assert.doesNotMatch(styles, /min-width:\s*560px/, 'Phone charts should not require horizontal scrolling.');
assert.match(styles, /analysis-coach-bento__cta:focus-visible\s*\{[^}]*outline:\s*2px solid #ffb4a7;[^}]*outline-offset:\s*3px;/, 'today action should retain visible keyboard focus');
assert.match(styles, /:is\(\.analysis-coach-bento__recent-row, \.analysis-coach-bento__toggle button\):focus-visible\s*\{[^}]*outline:\s*2px solid var\(--bento-accent\);/, 'recent sessions and chart windows should retain visible keyboard focus');
assert.match(styles, /body:is\(\.theme-midnight, \.theme-high-contrast\) #root \.analysis-insight-detail-page\.is-coach-insight \.analysis-coach-bento\s*\{[^}]*--bento-card:[^}]*--bento-ink:\s*#f8f4ef;/, 'coach tiles should retain theme-specific readable surfaces');

console.log('analysis coach insight bento redesign smoke test passed');
