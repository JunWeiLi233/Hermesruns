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
assert.match(home.title, /Running Analytics/);
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

// Every page of the app has a title of its own, so the tab, the history and a screen reader can tell them apart (BUG-018).
const genericPrivateTitle = getSeoMetadata('/an-address-the-app-does-not-know', 'en').title;
const pageRoutes = [
  '/login', '/signup', '/forgot-password', '/profile', '/runs', '/runs/12', '/analysis', '/heatmap', '/weather', '/today-run', '/rewards',
  '/training-log', '/settings', '/settings/import-data', '/shoes', '/shoes/add', '/shoe-catalog', '/races', '/races/details/3', '/schedule',
  '/muscle-training', '/prediction/5k', '/prediction/10k', '/prediction/half', '/prediction/marathon',
];
for (const language of ['en', 'zh-CN']) {
  const titles = pageRoutes.map((route) => getSeoMetadata(route, language).title);
  assert.equal(new Set(titles).size, titles.length, `every page has a title of its own (${language}): ${titles.join(' / ')}`);
  for (const title of titles) assert.match(title, / \| HermesRuns$/, `a page title ends with the product name (${language})`);
  assert.notEqual(getSeoMetadata('/profile', language).title, getSeoMetadata('/an-address-the-app-does-not-know', language).title);
}
assert.equal(getSeoMetadata('/login', 'en').title, 'Sign in | HermesRuns');
assert.equal(getSeoMetadata('/prediction/10k', 'en').title, '10K prediction | HermesRuns');
assert.equal(getSeoMetadata('/login', 'en').robots.startsWith('noindex'), true, 'a page title does not make a private page indexable');
// A page added to the router without a title falls back to the generic one and fails here.
const routedPages = [...appSource.matchAll(/<Route path="([^"*]+)" element=\{<(UserOnlyRoute|Login|Signup|ForgotPassword)/g)]
  .map((match) => match[1].replace(':id', '1').replace(':insightKey', 'x').replace(':distKey', '5k').replace(':raceId', '1'));
assert.ok(routedPages.length >= 20, 'the router pages were found');
for (const route of routedPages) {
  assert.notEqual(getSeoMetadata(route, 'en').title, genericPrivateTitle, `${route} needs a title in utils/seoMetadata.js`);
}

const chineseHome = getSeoMetadata('/', 'zh-CN');
assert.equal(chineseHome.locale, 'zh_CN');
assert.match(chineseHome.title, /HermesRuns$/);

assert.match(appSource, /<SeoHead \/>/);
assert.match(seoSource, /X-Robots|robots/);
for (const marker of [
  'rel="canonical"',
  'og:image',
  'twitter:image',
  String.raw`application/ld\+json`,
  String.raw`hermesruns\.com/og-image\.png`,
]) {
  assert.match(indexHtml, new RegExp(marker), `index.html should contain ${marker}.`);
}

assert.match(indexHtml, /id="hermes-seo-fallback"/, 'Homepage should include crawlable fallback content.');
assert.match(indexHtml, /<h1[^>]*>Running analytics you can check<\/h1>/);
assert.match(indexHtml, /href="\/signup"/);
assert.match(indexHtml, /href="\/privacy"/);
assert.match(indexHtml, /href="\/terms"/);
assert.match(indexHtml, /alt="HermesRuns: running analytics you can check"/);
assert.match(indexHtml, /<h2[^>]*>One running analytics app for the decisions that matter<\/h2>/);
assert.match(indexHtml, /<h3>VO2max and training zones<\/h3>/);
assert.match(indexHtml, /<h3>Route heatmaps<\/h3>/);
assert.match(indexHtml, /<h3>Shoe mileage tracking<\/h3>/);
assert.match(indexHtml, /<h2[^>]*>Running analytics FAQ<\/h2>/);
assert.match(indexHtml, /"@type": "FAQPage"/);
assert.match(indexHtml, /"dateModified": "2026-10-09"/);

console.log('[PASS] Route-aware SEO metadata contract passed.');
