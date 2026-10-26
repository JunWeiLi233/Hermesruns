import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { JSDOM } from 'jsdom';
import { getSeoMetadata } from '../src/utils/seoMetadata.js';
import * as publicCopy from '../src/utils/publicHomeCopy.js';
import en from '../src/i18n/locales/en/publicLanding.js';
import zh from '../src/i18n/locales/zh-CN/publicLanding.js';

const read = (relative) => fs.readFileSync(new URL(relative, import.meta.url), 'utf8');
const llms = read('../public/llms.txt');
const document = new JSDOM(read('../../backend/src/main/resources/static/public-pages/home.html')).window.document;

test('product definition is available without JavaScript and has a stable citation anchor', () => {
  const about = document.querySelector('#faq-about');
  assert.ok(about, 'A standalone product definition must be in the initial public HTML');
  assert.match(about.querySelector('summary').textContent, /What is HermesRuns/);
  assert.match(about.querySelector('p').textContent, /^HermesRuns is a running analytics and adaptive training app/);
  assert.match(about.textContent, /VDOT.*laboratory VO2max/);
  assert.ok(about.hasAttribute('open'));
});

test('llms facts and page section links agree with public content', () => {
  assert.ok(llms.includes(getSeoMetadata('/').description));
  assert.match(llms, /Strava or Garmin/);
  assert.match(llms, /COROS.*file upload/);
  assert.match(llms, /38\.3/);
  assert.match(llms, /support@hermesruns\.com/);
  const anchors = [...llms.matchAll(/https:\/\/hermesruns\.com\/#([a-z0-9-]+)/g)].map((match) => match[1]);
  assert.ok(anchors.includes('faq-about'));
  assert.ok(anchors.includes('faq-history'));
  for (const anchor of anchors) assert.ok(document.getElementById(anchor), `Missing llms destination: ${anchor}`);
});

test('visible summary date matches page structured data and both translations are present', () => {
  assert.equal(publicCopy.PUBLIC_HOME_REVIEW_DATE, '2026-10-20');
  assert.ok(llms.includes(`Methods summary updated: ${publicCopy.PUBLIC_HOME_REVIEW_DATE}.`));
  assert.equal(document.querySelector('#methods time')?.dateTime, publicCopy.PUBLIC_HOME_REVIEW_DATE);
  const structured = JSON.parse(document.querySelector('#hermes-seo-jsonld').textContent);
  assert.equal(structured['@graph'].find((node) => node['@type'] === 'WebPage').dateModified, publicCopy.PUBLIC_HOME_REVIEW_DATE);
  for (const copy of [en, zh]) {
    assert.ok(copy.home_faq_about_q.includes('HermesRuns'));
    assert.ok(copy.home_faq_about_a.startsWith('HermesRuns'));
    assert.ok(copy.home_methods_updated.includes('{date}'));
  }
});

test('FAQ anchors are unique and the methods import link points to its exact answer', () => {
  const faqs = [...document.querySelectorAll('details.lv3-faq-item')];
  assert.equal(faqs.length, 8);
  assert.equal(new Set(faqs.map((node) => node.id)).size, 8);
  assert.ok(faqs.every((node) => /^faq-[a-z]+$/.test(node.id)));
  assert.ok(document.querySelector('#methods a[href="#faq-history"]'));
});

test('current wildcard robots rules allow public content and retain private-route exclusions', () => {
  const source = read('../public/robots.txt');
  assert.deepEqual([...source.matchAll(/^User-agent:\s*(.+)$/gm)].map((match) => match[1].trim()), ['*']);
  const rules = [...source.matchAll(/^(Allow|Disallow):\s*(\S+)$/gm)].map(([, directive, prefix]) => ({ directive, prefix }));
  const allowed = (url) => {
    const matches = rules.filter((rule) => url.startsWith(rule.prefix)).sort((a, b) => b.prefix.length - a.prefix.length || (a.directive === 'Allow' ? -1 : 1));
    return !matches.length || matches[0].directive === 'Allow';
  };
  // There are no bot-specific groups: these agents all inherit the same wildcard policy.
  for (const agent of ['Googlebot', 'bingbot', 'OAI-SearchBot', 'PerplexityBot', 'Claude-SearchBot', 'GPTBot', 'ClaudeBot', 'CCBot']) {
    for (const route of ['/', '/terms', '/privacy', '/llms.txt', '/assets/public.js']) assert.equal(allowed(route), true, `${agent} ${route}`);
    for (const route of ['/api/activities', '/profile', '/runs/123', '/settings', '/login', '/signup']) assert.equal(allowed(route), false, `${agent} ${route}`);
  }
});
