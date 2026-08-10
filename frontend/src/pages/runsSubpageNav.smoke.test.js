import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const srcRoot = path.resolve(here, '..');
const read = (relativePath) => readFileSync(path.join(srcRoot, relativePath), 'utf8');

const navSource = read('components/RunsSubpageNav.jsx');
const runDetailSource = read('pages/RunDetail.jsx');
const styleSource = read('styles/runs-subnav.css');
const enSource = read('i18n/locales/en/pages.js');
const zhSource = read('i18n/locales/zh-CN/pages.js');

for (const sectionId of [
  'run-detail-overview',
  'run-detail-coach',
  'run-detail-comparison',
  'run-detail-telemetry',
  'run-detail-splits',
  'run-detail-metrics',
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

assert.match(styleSource, /\.runs-subnav-link\.is-active/);
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
  'subnav_metrics',
  'subnav_import',
]) {
  assert.match(enSource, new RegExp(`"${key}":`), `English run-detail copy is missing ${key}.`);
  assert.match(zhSource, new RegExp(`"${key}":`), `Chinese run-detail copy is missing ${key}.`);
}

console.log('[PASS] Runs subpage navigation guard passed.');
