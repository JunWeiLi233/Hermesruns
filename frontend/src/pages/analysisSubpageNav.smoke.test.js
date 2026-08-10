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
const styleSource = read('styles/analysis-subnav.css');
const enSource = read('i18n/locales/en/components.js');
const zhSource = read('i18n/locales/zh-CN/components.js');

for (const route of [
  '/analysis/load-balance',
  '/analysis/intensity',
  '/analysis/injury-risk',
  '/analysis/coach-insight',
  '/prediction/5k',
  '/prediction/10k',
  '/prediction/half',
  '/prediction/marathon',
]) {
  assert.ok(navSource.includes(route), `Analysis subpage navigation is missing ${route}.`);
}

assert.match(navSource, /aria-current=\{active \? 'page' : undefined\}/, 'The current analysis subsection should be exposed to assistive technology.');

for (const source of [insightSource, predictionSource]) {
  assert.match(source, /import AnalysisSubpageNav from '\.\.\/components\/AnalysisSubpageNav';/);
  assert.match(source, /<AnalysisSubpageNav/);
}

assert.match(styleSource, /\.analysis-subnav-link\.is-active/);
assert.match(styleSource, /@media \(max-width: 860px\)[\s\S]*\.analysis-subnav-nav[\s\S]*overflow-x:\s*auto/);
assert.match(styleSource, /@media \(prefers-reduced-motion: reduce\)/);

for (const key of ['subnav_title', 'subnav_current', 'subnav_insights', 'subnav_predictions', 'subnav_aria_label']) {
  assert.match(enSource, new RegExp(`"${key}":`), `English analysis copy is missing ${key}.`);
  assert.match(zhSource, new RegExp(`"${key}":`), `Chinese analysis copy is missing ${key}.`);
}

console.log('[PASS] Analysis subpage navigation guard passed.');
