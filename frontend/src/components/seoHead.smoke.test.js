import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getSeoMetadata } from '../utils/seoMetadata.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const frontendRoot = path.resolve(here, '..');
const appSource = readFileSync(path.join(frontendRoot, 'App.jsx'), 'utf8');
const seoSource = readFileSync(path.join(here, 'SeoHead.jsx'), 'utf8');
const indexHtml = readFileSync(path.join(frontendRoot, '..', 'index.html'), 'utf8');

const home = getSeoMetadata('/', 'en');
assert.equal(home.indexable, true);
assert.equal(home.canonicalUrl, 'https://hermesruns.com/');
assert.match(home.title, /Adaptive Running Plans/);
assert.doesNotMatch(home.title, /Strava/, 'The homepage title should lead with the product, not a data source.');
assert.doesNotMatch(home.description, /Strava/, 'The homepage description should lead with the product, not a data source.');
assert.ok(home.description.length >= 120 && home.description.length <= 160, 'Homepage description should fit the recommended snippet length.');
assert.equal(home.structuredData['@graph'][2]['@type'], 'WebApplication');

for (const route of ['/terms', '/privacy']) {
  const metadata = getSeoMetadata(route, 'en');
  assert.equal(metadata.canonicalUrl, `https://hermesruns.com${route}`);
  assert.equal(metadata.openGraphType, 'website');
  assert.equal(metadata.structuredData['@type'], 'WebPage');
}

const privateRoute = getSeoMetadata('/profile', 'en');
assert.equal(privateRoute.canonicalUrl, null);
assert.match(privateRoute.robots, /^noindex,nofollow/);
assert.equal(privateRoute.structuredData, null);

const chineseHome = getSeoMetadata('/', 'zh-CN');
assert.equal(chineseHome.locale, 'zh_CN');
assert.match(chineseHome.title, /HermesRuns$/);

assert.match(appSource, /<SeoHead \/>/);
assert.match(seoSource, /X-Robots|robots/);
assert.match(indexHtml, /name="robots" content="noindex,nofollow,noarchive"/,
  'The private SPA shell must default to noindex; public heads are generated per route.');
assert.doesNotMatch(indexHtml, /hermes-seo-fallback|<noscript>/,
  'Public documents must use the real React content rather than a separate fallback.');

console.log('[PASS] Route-aware SEO metadata contract passed.');
