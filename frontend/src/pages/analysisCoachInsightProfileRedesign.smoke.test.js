import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const source = fs.readFileSync(path.join(here, 'AnalysisInsightDetail.jsx'), 'utf8');
const styles = fs.readFileSync(path.join(here, '../styles/_split/analysis.css'), 'utf8');

const branchStart = source.indexOf("{insightKey === 'coach-insight' && coachSystem ? (");
const branchEnd = source.indexOf(") : insightKey === 'injury-risk' ? (", branchStart);

assert.ok(branchStart >= 0 && branchEnd > branchStart, 'coach insight branch should remain addressable');

const coachBranch = source.slice(branchStart, branchEnd);

[
  'analysis-coach-profile',
  'analysis-coach-profile-hero',
  'analysis-coach-profile-metrics',
  'analysis-coach-profile-workbench',
  'analysis-coach-profile-blueprint',
  'analysis-coach-profile-recent',
  'analysis-coach-profile-evidence',
].forEach((className) => {
  assert.match(coachBranch, new RegExp(className), `coach insight should render ${className}`);
});

[
  'coachSystem.readinessScore',
  'coachSystem.forecastLabel',
  'coachSystem.keyWorkout',
  'coachSystem.statCards',
  'coachSystem.recentRows',
  'coachPrimarySession',
  'coachSecondarySessions',
  'coachSystem.phases',
  'coachSystem.reasons',
  'coachFocusShare',
].forEach((binding) => {
  assert.match(coachBranch, new RegExp(binding.replaceAll('.', '\\.')), `coach insight should preserve ${binding}`);
});

assert.match(coachBranch, /navigate\('\/analysis'\)/, 'back action should return to Analysis');
assert.match(coachBranch, /navigate\(`\/run\/\$\{row\.id\}`\)/, 'recent sessions should still open run detail');
assert.match(coachBranch, /navigate\('\/today-run'\)/, 'blueprint CTA should still open Today Run');
assert.doesNotMatch(
  coachBranch,
  /<section className="analysis-coach-command-hero"/,
  'legacy command-center hero shell should be replaced',
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

console.log('analysis coach insight Profile redesign smoke test passed');
