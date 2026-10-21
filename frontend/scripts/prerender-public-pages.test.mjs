import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { readFileSync, mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { collectMissingDocumentAssets } from './static-document-assets.mjs';
import { getSeoMetadata } from '../src/utils/seoMetadata.js';
import en from '../src/i18n/locales/en/pages.js';
import zh from '../src/i18n/locales/zh-CN/pages.js';
import { assertPublicClientBoundary, renderPublicDocument } from './prerender-public-pages.mjs';

test('public summaries use the visible English and Chinese introduction', () => {
  for (const [locale, copy] of [['en', en], ['zh-CN', zh]]) {
    assert.equal(getSeoMetadata('/', locale).description, copy.landing.home_hero_copy);
  }
  assert.ok(readFileSync(new URL('../public/llms.txt', import.meta.url), 'utf8').includes(getSeoMetadata('/').description));
});

test('public entry rejects a transitive dependency on private dictionaries', () => {
  const manifest = {
    'public.html': { file: 'assets/public.js', imports: ['shared'] },
    shared: { file: 'assets/shared.js', imports: ['private-messages'] },
    'private-messages': { file: 'assets/i18n-en-private.js' },
  };
  assert.throws(() => assertPublicClientBoundary(manifest), /Private application dependency/);
  manifest.shared.imports = ['public-messages'];
  manifest['public-messages'] = { file: 'assets/landing-en.js' };
  assert.doesNotThrow(() => assertPublicClientBoundary(manifest));
  manifest.shared.imports = ['missing'];
  assert.throws(() => assertPublicClientBoundary(manifest), /dependency missing/);
  manifest.shared.imports = ['public-messages'];
  manifest.shared.dynamicImports = ['private-messages'];
  assert.throws(() => assertPublicClientBoundary(manifest), /Private application dependency/);
});

test('each initial head describes its own route without duplicate metadata', () => {
  const template = '<!DOCTYPE html><html lang="en"><head><title>Private</title><meta name="robots" content="noindex"></head><body><div id="root"></div></body></html>';
  for (const route of ['/', '/terms', '/privacy']) {
    const metadata = getSeoMetadata(route);
    const html = renderPublicDocument(template, { metadata, content: '<main><h1>Public content</h1></main>' }, ['assets/page.css']);
    const doc = new JSDOM(html).window.document;
    assert.equal(doc.title, metadata.title);
    assert.equal(doc.querySelectorAll('title,link[rel="canonical"],meta[name="description"],meta[name="robots"]').length, 4);
    assert.equal(doc.querySelector('link[rel="canonical"]').href, metadata.canonicalUrl);
    assert.equal(doc.querySelector('meta[property="og:url"]').content, metadata.canonicalUrl);
    assert.equal(doc.querySelector('meta[name="description"]').content, metadata.description);
    assert.deepEqual(JSON.parse(doc.querySelector('#hermes-seo-jsonld').textContent), metadata.structuredData);
    assert.equal(doc.querySelector('#root h1').textContent, 'Public content');
    assert.equal(doc.querySelector('link[rel="stylesheet"]').getAttribute('href'), '/assets/page.css');
  }
});

test('build completeness catches a missing stylesheet referenced only by a public document', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'hermes-public-assets-'));
  try {
    mkdirSync(path.join(dir, 'public-pages'));
    writeFileSync(path.join(dir, 'index.html'), '<div id="root"></div>');
    writeFileSync(path.join(dir, 'public-pages/home.html'), '<h1>Home</h1>');
    writeFileSync(path.join(dir, 'public-pages/terms.html'), '<h1>Terms</h1>');
    writeFileSync(path.join(dir, 'public-pages/privacy.html'), '<link rel="stylesheet" href="/assets/legal.css">');
    assert.deepEqual(collectMissingDocumentAssets(dir), ['assets/legal.css']);
    mkdirSync(path.join(dir, 'assets'));
    writeFileSync(path.join(dir, 'assets/legal.css'), 'body{}');
    assert.deepEqual(collectMissingDocumentAssets(dir), []);
  } finally {
    if (!dir.startsWith(path.join(tmpdir(), 'hermes-public-assets-'))) throw new Error('Unexpected test directory');
    rmSync(dir, { recursive: true, force: true });
  }
});

test('build completeness checks responsive image candidates in public documents', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'hermes-public-assets-'));
  try {
    mkdirSync(path.join(dir, 'public-pages'));
    mkdirSync(path.join(dir, 'assets'));
    writeFileSync(path.join(dir, 'index.html'), '<div id="root"></div>');
    writeFileSync(path.join(dir, 'assets/card.webp'), 'image');
    writeFileSync(path.join(dir, 'public-pages/home.html'), '<img src="/assets/card.webp" srcset="/assets/card.webp 320w, /assets/card-large.webp 640w">');
    writeFileSync(path.join(dir, 'public-pages/terms.html'), '<h1>Terms</h1>');
    writeFileSync(path.join(dir, 'public-pages/privacy.html'), '<h1>Privacy</h1>');
    assert.deepEqual(collectMissingDocumentAssets(dir), ['assets/card-large.webp']);
  } finally {
    if (!dir.startsWith(path.join(tmpdir(), 'hermes-public-assets-'))) throw new Error('Unexpected test directory');
    rmSync(dir, { recursive: true, force: true });
  }
});
