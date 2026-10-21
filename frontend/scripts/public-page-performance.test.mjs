import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { gzipSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';

const root = fileURLToPath(new URL('../../backend/src/main/resources/static/', import.meta.url));
const document = new JSDOM(fs.readFileSync(path.join(root, 'public-pages/home.html'), 'utf8')).window.document;
const assetPath = (url) => path.join(root, new URL(url, 'http://localhost').pathname);

test('public startup stays within its JavaScript and CSS delivery budgets', () => {
  const scripts = [...document.querySelectorAll('script[src],link[rel="modulepreload"]')]
    .map((node) => node.getAttribute('src') || node.getAttribute('href'));
  const styles = [...document.querySelectorAll('link[rel="stylesheet"]')].map((node) => node.getAttribute('href'));
  assert.ok(![...scripts, ...styles].some((url) => url.includes('LegalPage-')), 'Homepage startup must defer legal-page code and styles');
  const gzipBytes = (urls) => [...new Set(urls)].reduce((sum, url) => sum + gzipSync(fs.readFileSync(assetPath(url))).length, 0);
  assert.ok(gzipBytes(scripts) < 160 * 1024, `Public initial JavaScript exceeds 160 KiB: ${gzipBytes(scripts)}`);
  assert.ok(gzipBytes(styles) < 12 * 1024, `Public initial CSS exceeds 12 KiB: ${gzipBytes(styles)}`);
  for (const url of scripts) {
    const body = fs.readFileSync(assetPath(url), 'utf8');
    assert.ok(!body.includes('shoe_count'), `Public startup contains private profile messages: ${url}`);
    assert.ok(!body.includes('training_authoring'), `Public startup contains private training messages: ${url}`);
  }
});

test('public HTML keeps early hero discovery and complete responsive image candidates', () => {
  const hero = document.querySelector('.lv3-hero img');
  assert.equal(hero.getAttribute('fetchpriority'), 'high');
  assert.notEqual(hero.getAttribute('loading'), 'lazy');
  assert.ok(fs.existsSync(assetPath(hero.getAttribute('src'))));
  const card = document.querySelector('.lv3-goal img');
  const closing = document.querySelector('.lv3-cta img');
  for (const image of [card, closing]) {
    assert.ok(image.getAttribute('srcset'), 'Goal and closing images need responsive candidates');
    assert.ok(image.getAttribute('sizes'), 'Responsive candidates need accurate sizes');
    assert.equal(image.getAttribute('loading'), 'lazy');
    for (const candidate of image.getAttribute('srcset').split(',')) {
      assert.ok(fs.existsSync(assetPath(candidate.trim().split(/\s+/)[0])), `Missing candidate: ${candidate}`);
    }
  }
});
