import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const srcRoot = path.resolve(here, '..');
const read = (relativePath) => readFileSync(path.join(srcRoot, relativePath), 'utf8');

const navSource = read('components/RunsSubpageNav.jsx');
const appIconSource = read('components/AppIcon.jsx');
const runDetailSource = read('pages/RunDetail.jsx');
const styleSource = read('styles/runs-subnav.css');
const runnerShellStyleSource = read('styles/_split/runner-shell.css');
const enSource = read('i18n/locales/en/pages.js');
const zhSource = read('i18n/locales/zh-CN/pages.js');

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
assert.match(navSource, /recentRuns\.slice\(0, 4\)/, 'Runs navigation should keep the recent-activity list bounded.');
assert.match(runDetailSource, /import RunsSubpageNav from '\.\.\/components\/RunsSubpageNav';/);
assert.match(runDetailSource, /<RunsSubpageNav/);
assert.match(runDetailSource, /sessionStorage\.setItem\('hermes_selected_run'/, 'Recent-run navigation should seed the existing detail cache.');

assert.match(navSource, /runner-shell-side-link runs-subnav-link/);
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
