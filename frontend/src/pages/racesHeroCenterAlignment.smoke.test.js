import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const styleSource = readFileSync(path.join(here, '..', 'styles', '_split', 'races.css'), 'utf8');

assert.match(
  styleSource,
  /\.race-center-hero-body\s*\{[\s\S]*?align-items:\s*center;[\s\S]*?justify-content:\s*center;[\s\S]*?text-align:\s*center;/,
  'The races hero body should center its content horizontally and vertically.',
);

assert.match(
  styleSource,
  /\.race-center-hero-body\s*\{[\s\S]*?min-height:\s*430px;[\s\S]*?box-sizing:\s*border-box;/,
  'The races hero body should have a real centering box instead of relying on a percentage height against min-height.',
);

assert.match(
  styleSource,
  /@media\s*\(max-width:\s*720px\)[\s\S]*?\.race-center-hero-body\s*\{\s*min-height:\s*360px;/,
  'The races hero body should keep its centered layout at the mobile hero height.',
);

assert.match(
  styleSource,
  /\.race-center-hero-actions\s*\{\s*width:\s*100%;\s*gap:\s*12px;\s*justify-content:\s*center;/,
  'The races hero actions should remain centered beneath the copy.',
);

console.log('[PASS] Races hero center alignment guard passed.');
