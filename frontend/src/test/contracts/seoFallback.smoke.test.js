import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const indexSource = readFileSync(path.join(here, "../../../index.html"), 'utf8');
const appSource = readFileSync(path.join(here, "../../App.jsx"), 'utf8');

assert.match(
  indexSource,
  /<noscript>\s*<div id="hermes-seo-fallback"[\s\S]*?<\/div>\s*<\/noscript>/,
  'The SEO fallback must render only when JavaScript is disabled.',
);
assert.doesNotMatch(
  appSource,
  /SeoFallbackCleanup/,
  'The React app should not need to remove a live duplicate fallback page.',
);
assert.match(
  indexSource,
  /--fallback-paper:\s*#f4efe6/,
  'The fallback should use the React landing page warm-paper surface.',
);
assert.match(
  indexSource,
  /--fallback-coral:\s*#f07561/,
  'The fallback should use the React landing page coral accent.',
);
assert.match(
  indexSource,
  /font:\s*16px\/1\.7\s+"Inter",\s*"Manrope"/,
  'The fallback should use the React landing page typography stack.',
);
assert.match(
  indexSource,
  /\.hermes-seo-fallback__feature-grid\s*\{[^}]*background:\s*#0a0a0b/s,
  'The fallback feature deck should match the React landing page dark section.',
);

console.log('[PASS] SEO fallback is isolated and visually aligned with the React landing page.');
