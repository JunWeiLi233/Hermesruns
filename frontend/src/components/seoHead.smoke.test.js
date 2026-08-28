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
assert.match(chineseHome.title, /Hermes$/);

assert.match(appSource, /<SeoHead \/>/);
assert.match(seoSource, /X-Robots|robots/);
for (const marker of [
  'rel="canonical"',
  'og:image',
  'twitter:image',
  String.raw`application/ld\+json`,
  String.raw`hermes-og-image\.svg`,
]) {
  assert.match(indexHtml, new RegExp(marker), `index.html should contain ${marker}.`);
}

assert.match(indexHtml, /id="hermes-seo-fallback"/, 'Homepage should include crawlable fallback content.');
assert.match(indexHtml, /<h1[^>]*>Running analytics with Strava sync<\/h1>/);
assert.match(indexHtml, /href="\/signup"/);
assert.match(indexHtml, /href="\/privacy"/);
assert.match(indexHtml, /href="\/terms"/);
assert.match(indexHtml, /alt="Hermes running analytics dashboard preview"/);
assert.match(indexHtml, /<h2[^>]*>One running analytics app for the decisions that matter<\/h2>/);
assert.match(indexHtml, /<h3>VO2max and training zones<\/h3>/);
assert.match(indexHtml, /<h3>Route heatmaps<\/h3>/);
assert.match(indexHtml, /<h3>Shoe mileage tracking<\/h3>/);
assert.match(indexHtml, /<h2[^>]*>Running analytics FAQ<\/h2>/);
assert.match(indexHtml, /"@type": "FAQPage"/);
assert.match(indexHtml, /"dateModified": "2026-08-27"/);

console.log('[PASS] Route-aware SEO metadata contract passed.');
