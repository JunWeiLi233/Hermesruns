import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const srcRoot = path.resolve(here, "../../..");
const read = (relativePath) => readFileSync(path.join(srcRoot, relativePath), 'utf8');

const navSource = read('./components/RunsSubpageNav.jsx');
const appIconSource = read('./components/AppIcon.jsx');
const runDetailSource = read('./pages/runs/RunDetail.jsx');
const styleSource = read('./styles/runs-subnav.css');
const runnerShellStyleSource = read('./styles/_split/runner-shell.css');
const enSource = read('./i18n/locales/en/pages.js');
const zhSource = read('./i18n/locales/zh-CN/pages.js');

for (const sectionId of [
  'run-detail-overview',
  'run-detail-coach',
  'run-detail-comparison',
  'run-detail-telemetry',
  'run-detail-splits',
]) {
  assert.ok(navSource.includes(sectionId), `Runs subpage navigation is missing ${sectionId}.`);
  assert.ok(runDetailSource.includes(`id="${sectionId}"`), `Run Detail is missing the ${sectionId} anchor.`);
}

assert.match(navSource, /aria-current=\{active \? 'location' : undefined\}/, 'The visible run section should be exposed to assistive technology.');
assert.match(navSource, /IntersectionObserver/, 'Runs navigation should track the visible detail section.');
for (const railControl of [
  'runs-subnav-overview-link',
  'run-detail-overview',
  'run-detail-coach',
  'run-detail-comparison',
  'run-detail-telemetry',
  'run-detail-splits',
  'runs-subnav-recent-toggle',
]) {
  assert.ok(navSource.includes(railControl), `Run Detail rail is missing the ${railControl} control.`);
}
assert.match(
  navSource,
  /function RunSectionLink\(\{ active, icon, label, onActivate, sectionId \}\)/,
  'Run Detail section links should be able to activate their own rail item before the browser finishes scrolling.',
);
assert.match(
  navSource,
  /onClick=\{\(\) => onActivate\(sectionId\)\}/,
  'Run Detail section links should keep the active rail item in sync with direct anchor clicks.',
);
assert.match(
  navSource,
  /const updateActiveSection = \(\) => \{[\s\S]*?getBoundingClientRect\(\)\.top <= activeMarker[\s\S]*?visibleTargets\[visibleTargets\.length - 1\]/,
  'Run Detail navigation should choose the last section above its scroll marker so nested sections cannot activate a neighboring item.',
);
assert.match(
  navSource,
  /const isAtPageEnd = window\.innerHeight \+ window\.scrollY >= document\.documentElement\.scrollHeight - 2/,
  'Run Detail navigation should recognize when the final section is visible at the bottom of the document.',
);
assert.match(
  navSource,
  /const nextTarget = isAtPageEnd \? targets\[targets\.length - 1\] : visibleTargets\[visibleTargets\.length - 1\] \|\| targets\[0\]/,
  'Run Detail navigation should activate the final section when the page cannot scroll it up to the marker.',
);
assert.match(
  navSource,
  /window\.addEventListener\('scroll', updateActiveSection, \{ passive: true \}\)/,
  'Run Detail navigation should recompute its active section as the page scrolls.',
);
assert.match(
  navSource,
  /if \(!showSections\) return undefined;[\s\S]*?const observer = typeof IntersectionObserver === 'undefined' \? null : new IntersectionObserver/,
  'Run Detail navigation should retain scroll tracking even when IntersectionObserver is unavailable.',
);
assert.match(
  navSource,
  /new IntersectionObserver\(\(\) => \{\s*updateActiveSection\(\);/,
  'Run Detail navigation should recompute after observer exit events as well as entry events.',
);
assert.match(navSource, /recentRuns\.slice\(0, 4\)/, 'Runs navigation should keep the recent-activity list bounded.');
assert.match(
  navSource,
  /aria-controls=\{recentRunsOpen \? 'runs-subnav-recent-list' : undefined\}/,
  'The recent-run toggle should only reference a mounted list when the disclosure is open.',
);
assert.match(
  navSource,
  /const recentRunsActive = activeSection === 'runs-subnav-recent-toggle';/,
  'Clicking the recent-runs disclosure should move the rail highlight to 近期跑步.',
);
assert.match(navSource, /setActiveSection\('runs-subnav-recent-toggle'\)/);
assert.match(navSource, /recentRunsActive \? ' is-active' : ''/);
assert.match(
  navSource,
  /aria-current=\{recentRunsActive \? 'location' : undefined\}/,
  'The active recent-runs item should be exposed to assistive technology.',
);
assert.match(runDetailSource, /import RunsSubpageNav from '\.\.\/\.\.\/components\/RunsSubpageNav';/);
assert.match(runDetailSource, /<RunsSubpageNav/);
assert.match(runDetailSource, /sessionStorage\.setItem\('hermes_selected_run'/, 'Recent-run navigation should seed the existing detail cache.');

assert.match(navSource, /runner-shell-side-link runs-subnav-link/);
assert.match(
  styleSource,
  /\.run-detail-runner-page\.is-sidebar-collapsed \.runs-subnav-link-copy\s*\{[^}]*display:\s*none;/,
  'The default run-detail rail should hide link labels and remain icon-only.',
);
assert.match(
  styleSource,
  /@media \(min-width: 1100px\)[\s\S]*?\.run-detail-runner-page\.is-sidebar-collapsed:has\(> \.runner-shell-sidebar:hover\) \.runs-subnav-link-copy,[\s\S]*?\.run-detail-runner-page\.is-sidebar-collapsed:has\(> \.runner-shell-sidebar:focus-within\) \.runs-subnav-link-copy\s*\{[^}]*display:\s*inline;/,
  'Run-detail labels should return when the collapsed rail expands on hover or keyboard focus.',
);
assert.match(navSource, /aria-label=\{label\}/, 'Run-detail section links should retain accessible labels when their copy is hidden.');
assert.match(navSource, /aria-label=\{t\('run_detail\.subnav_recent'\)\}/, 'The recent-runs control should retain an accessible label when collapsed.');
assert.match(runnerShellStyleSource, /\.runner-shell-side-link\.is-active/);
assert.match(
  navSource,
  /run-detail-splits'[^\n]+icon: 'splits'/,
  'The splits navigation item should use its own lap-track icon instead of the generic distance glyph.',
);
assert.match(
  appIconSource,
  /case 'splits':[\s\S]*?<ellipse cx="12" cy="12" rx="8\.5" ry="5\.5" \/>/,
  'The splits icon should render a recognizable outer running lane.',
);
assert.match(
  appIconSource,
  /case 'splits':[\s\S]*?<ellipse cx="12" cy="12" rx="5\.2" ry="2\.6" \/>/,
  'The splits icon should render a second lane so it reads as a track at navigation size.',
);
assert.match(
  navSource,
  /run-detail-coach'[^\n]+icon: 'coach_review'/,
  'The coach review navigation item should use its dedicated review glyph.',
);
assert.match(
  appIconSource,
  /case 'coach_review':[\s\S]*?<path d="M5\.5 4\.5h13A1\.5 1\.5 0 0 1 20 6v8a1\.5 1\.5 0 0 1-1\.5 1\.5H11L7 19v-3\.5H5\.5A1\.5 1\.5 0 0 1 4 14V6a1\.5 1\.5 0 0 1 1\.5-1\.5Z" \/>/,
  'The coach review icon should keep a simple speech-review silhouette at navigation size.',
);
assert.match(
  appIconSource,
  /case 'coach_review':[\s\S]*?<path d="m8 10 2\.2 2\.2 4\.2-4\.4" \/>/,
  'The coach review icon should include a clear completed-review check.',
);
assert.match(styleSource, /@media \(max-width: 860px\)[\s\S]*\.runs-subnav-nav[\s\S]*overflow-x:\s*auto/);
assert.match(styleSource, /@media \(prefers-reduced-motion: reduce\)/);

for (const key of [
  'subnav_title',
  'subnav_current',
  'subnav_sections',
  'subnav_recent',
  'subnav_aria_label',
  'subnav_overview',
  'subnav_coach',
  'subnav_comparison',
  'subnav_telemetry',
  'subnav_splits',
  'subnav_import',
]) {
  assert.match(enSource, new RegExp(`"${key}":`), `English run-detail copy is missing ${key}.`);
  assert.match(zhSource, new RegExp(`"${key}":`), `Chinese run-detail copy is missing ${key}.`);
}

console.log('[PASS] Runs subpage navigation guard passed.');
