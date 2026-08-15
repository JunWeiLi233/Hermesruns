import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const profileSource = readFileSync(path.join(here, 'ProfileDashboard.jsx'), 'utf8');
const styleSource = readFileSync(path.join(here, '../styles/style.generated.css'), 'utf8');
const redesignStyleSource = readFileSync(path.join(here, '../styles/_split/profile-dashboard-redesign.css'), 'utf8');
const profileStyleSource = readFileSync(path.join(here, '../styles/_split/profile.css'), 'utf8');
const sharedGlassStyleSource = readFileSync(path.join(here, '../styles/all-pages-liquid-glass.css'), 'utf8');

assert.match(
  profileSource,
  /hd-bar-tooltip/,
  'Profile weekly progress card should render the weekly bar tooltip.',
);

assert.match(
  profileSource,
  /onMouseEnter=\{\(\) => setActiveWeeklyBar\(bar\)\}[\s\S]*onMouseLeave=\{\(\) => setActiveWeeklyBar\(null\)\}/,
  'Weekly progress tooltip should be driven by the hovered weekly bar.',
);

assert.match(
  styleSource,
  /\.hd-bar-tooltip\s*\{/,
  'Profile weekly progress tooltip should have a dedicated style hook.',
);

assert.doesNotMatch(
  profileSource,
  /runner-dashboard-bar-tooltip\$\{activeWeeklyBar\.index <= 1 \? ' is-left' : activeWeeklyBar\.index >= 5 \? ' is-right' : ''\}/,
  'Weekly progress tooltip should no longer rely on brittle edge-snap classes for the first and last bars.',
);

assert.match(
  sharedGlassStyleSource,
  /\.runner-shell-page \.hd-content \.hd-weekly-card \.hd-card-head,[\s\S]*?\.runner-shell-page \.hd-content \.hd-weekly-card \.hd-bar-label\s*\{[^}]*background:\s*transparent\s*!important;/,
  'Weekly chart labels should stay transparent instead of showing a colored background strip behind the words.',
);

const sharedCardSweepIndex = sharedGlassStyleSource.lastIndexOf('[class*="-card"]');
const weeklyLabelResetIndex = sharedGlassStyleSource.lastIndexOf(
  '.runner-shell-page .hd-content .hd-weekly-card .hd-card-head,',
);
assert.ok(
  weeklyLabelResetIndex > sharedCardSweepIndex,
  'The weekly chart label reset must remain after the shared liquid-glass card sweep.',
);

assert.match(
  redesignStyleSource,
  /\.hd-weekly-card,[\s\S]*\.hd-sessions-card,[\s\S]*background:\s*var\(--hd-bg-card\)/,
  'The weekly chart card surface should remain intact while its labels lose their background.',
);

assert.match(
  profileStyleSource,
  /\.profile-dashboard-page \.runner-dashboard-weekly-card \.runner-dashboard-section-head,[\s\S]*\.runner-dashboard-weekly-card \.runner-dashboard-bar-col > span\s*\{[\s\S]*background:\s*transparent\s*!important;/,
  'The legacy weekly chart header should also keep its labels transparent when that markup is served.',
);

assert.match(
  profileStyleSource,
  /\.runner-dashboard-page \.runner-dashboard-weekly-card,[\s\S]*\.profile-dashboard-page \.runner-dashboard-weekly-card\s*\{[\s\S]*background:\s*transparent\s*!important;[\s\S]*background-image:\s*none\s*!important;/,
  'The legacy weekly card should not paint its gradient behind the chart header.',
);

const weeklyCardResetIndex = profileStyleSource.lastIndexOf(
  '.runner-dashboard-page .runner-dashboard-weekly-card,',
);
const finalProfileOverrideIndex = profileStyleSource.lastIndexOf(
  '/* Profile grid style refresh final override */',
);
assert.ok(
  weeklyCardResetIndex > finalProfileOverrideIndex,
  'The legacy weekly card reset must remain after the final profile gradient override.',
);

console.log('[PASS] Profile weekly progress tooltip guardrails passed.');
