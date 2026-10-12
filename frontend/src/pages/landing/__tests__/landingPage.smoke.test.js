import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

// Guardrails for the photo-led landing page (Landing.jsx, landingV3Content.js, styles/landing-v3.css).
const here = path.dirname(fileURLToPath(import.meta.url));
const srcRoot = path.resolve(here, '../../..');
const landingSource = readFileSync(path.join(here, '../Landing.jsx'), 'utf8');
const contentSource = readFileSync(path.join(here, '../landingV3Content.js'), 'utf8');
const css = readFileSync(path.join(srcRoot, 'styles/landing-v3.css'), 'utf8');
const assetsDir = path.join(srcRoot, 'assets/landing-v3');

// ── Document structure ──────────────────────────────────────────────────────────────────────────────
assert.match(landingSource, /<main id="landing-main" tabIndex=\{-1\}>/, 'The landing page needs a main landmark that the skip link can focus.');
assert.match(landingSource, /<a className="lv3-skip" href="#landing-main">/, 'The skip link should point at the main landmark.');
assert.equal([...landingSource.matchAll(/<h1[\s>]/g)].length, 1, 'The landing page should have exactly one h1.');
assert.equal([...landingSource.matchAll(/<header[\s>]/g)].length, 1, 'The landing page should have one banner header.');
assert.equal([...landingSource.matchAll(/<footer[\s>]/g)].length, 1, 'The landing page should have one footer.');

// ── Images: the hero is the only eager image, every photo is decorative ────────────────────────────────
const imgTags = [...landingSource.matchAll(/<img\b[^>]*>/g)].map((match) => match[0]);
assert.ok(imgTags.length >= 6, 'The landing page should render its photos as img elements.');
const eager = imgTags.filter((tag) => /fetchPriority="high"/.test(tag));
assert.equal(eager.length, 1, 'Exactly one landing image (the hero) should be fetched with high priority.');
assert.doesNotMatch(eager[0], /loading="lazy"/, 'The hero image is the largest contentful paint and must not be lazy.');
for (const tag of imgTags.filter((candidate) => candidate !== eager[0])) {
  assert.match(tag, /loading="lazy"/, `Below-the-fold landing images should be lazy: ${tag}`);
}
for (const tag of imgTags) assert.match(tag, /\balt=""/, `Landing photos are decorative and should have empty alt text: ${tag}`);

// ── Image weight: WebP only, sized for the page ──────────────────────────────────────────────────────
const assetFiles = readdirSync(assetsDir);
assert.ok(assetFiles.length >= 14, 'The landing photos and phone screenshot should live in assets/landing-v3.');
let totalBytes = 0;
for (const file of assetFiles) {
  assert.match(file, /\.webp$/, `Landing assets should be WebP: ${file}`);
  const size = statSync(path.join(assetsDir, file)).size;
  totalBytes += size;
  assert.ok(size <= 400 * 1024, `${file} should stay under 400 KiB (is ${Math.round(size / 1024)} KiB).`);
}
assert.ok(statSync(path.join(assetsDir, 'hero-golden-hour.webp')).size <= 150 * 1024, 'The hero image should stay under 150 KiB.');
assert.ok(totalBytes <= 1536 * 1024, `The landing photos should stay under 1.5 MiB in total (are ${Math.round(totalBytes / 1024)} KiB).`);

// ── Stylesheet: scoped to the landing, no external requests ────────────────────────────────────────────
// The route's CSS stays in the document after the visitor navigates on, so a global rule here would restyle the app.
const withoutComments = css.replace(/\/\*[\s\S]*?\*\//g, '');
assert.doesNotMatch(withoutComments, /@import|url\(\s*['"]?https?:|!important/, 'The landing CSS should not import, fetch from other origins, or use !important.');
function splitSelectors(prelude) {
  const parts = [];
  let depth = 0;
  let current = '';
  for (const char of prelude) {
    if (char === '(') depth += 1;
    if (char === ')') depth -= 1;
    if (char === ',' && depth === 0) { parts.push(current.trim()); current = ''; } else current += char;
  }
  if (current.trim()) parts.push(current.trim());
  return parts;
}
// Every rule prelude (the text before a "{"), except the @font-face and @media wrappers themselves.
const selectors = [];
for (const match of withoutComments.matchAll(/([^{}]+)\{/g)) {
  const text = match[1].trim();
  if (!text || text.startsWith('@media') || text.startsWith('@font-face')) continue;
  selectors.push(...splitSelectors(text));
}
assert.ok(selectors.length > 100, 'The landing stylesheet should have been parsed.');
for (const selector of selectors) {
  assert.match(selector, /^(?:\.landing-v3|\.lv3-|:where\(\.landing-v3\))/, `Landing CSS selectors must start with .landing-v3 or .lv3-, found: ${selector}`);
}
for (const match of withoutComments.matchAll(/@font-face\s*\{[^}]*font-family:\s*"([^"]+)"/g)) {
  assert.equal(match[1], 'Hermes Manrope', 'The landing stylesheet should only declare the self-hosted Hermes Manrope face.');
}

// ── Copy: every key resolves in both locales, none is orphaned, and the launch rules hold ───────────────────
const referenced = new Set([...`${landingSource}\n${contentSource}`.matchAll(/'landing\.([a-z0-9_]+)'/g)].map((match) => match[1]));
const loadLanding = async (locale) => (await import(pathToFileURL(path.join(srcRoot, `i18n/locales/${locale}/pages.js`)).href)).default.landing;
const en = await loadLanding('en');
const zh = await loadLanding('zh-CN');
for (const key of referenced) {
  assert.equal(typeof en[key], 'string', `landing.${key} is used by the landing page but missing from the en locale.`);
  assert.equal(typeof zh[key], 'string', `landing.${key} is used by the landing page but missing from the zh-CN locale.`);
}
const homeKeys = Object.keys(en).filter((key) => key.startsWith('home_'));
assert.ok(homeKeys.length >= 100, 'The landing copy should be in the en locale under landing.home_*.');
assert.deepEqual(Object.keys(zh).filter((key) => key.startsWith('home_')).sort(), homeKeys.slice().sort(), 'en and zh-CN should carry the same landing.home_* keys.');
for (const key of homeKeys) {
  assert.ok(referenced.has(key), `landing.${key} is not used by the landing page; remove it or use it.`);
  assert.ok(en[key].length > 0 && zh[key].length > 0, `landing.${key} should not be empty.`);
}
// The payments line is the one string the owner clears when Stripe goes live, so it must stay a key of its own.
assert.ok(referenced.has('studio_pricing_supporter_status'), 'The Supporter card should read its status line from landing.studio_pricing_supporter_status.');
assert.match(landingSource, /status \? <p className="lv3-plan-note">/, 'The status line should only render while the string is not empty.');

// Launch rules: no testimonials, user counts or ratings until there are real ones to show.
const copy = [...homeKeys.map((key) => en[key]), ...homeKeys.map((key) => zh[key])].join('\n');
for (const [pattern, what] of [
  [/[★☆⭐]/, 'star ratings'],
  [/\d[\d,.]*\s*\+?\s*(?:runners|users|athletes|members|跑者|用户)/i, 'user counts'],
  [/testimonial|loved by|rated\b|\breviews?\b|好评|口碑/i, 'testimonials or reviews'],
]) {
  assert.doesNotMatch(copy, pattern, `The landing page must not show ${what} (launch rules: nothing the product cannot back up).`);
}
assert.doesNotMatch(landingSource, /<blockquote|<figcaption/, 'The landing page has no quotes: there are no real testimonials to show yet.');

console.log('[PASS] Landing page guardrails passed.');
