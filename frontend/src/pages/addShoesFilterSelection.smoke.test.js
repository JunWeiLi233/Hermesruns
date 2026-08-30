import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const source = readFileSync(path.join(here, 'AddShoes.jsx'), 'utf8').replace(/\r\n/g, '\n');

assert.match(
  source,
  /function handleCategoryFilterPick\(categoryKey\) \{\n\s*setBrowserCategory\(categoryKey\);\n\s*setBrowserType\('all'\);\n\s*\}/,
  'Selecting a category must clear any selected type.',
);
assert.match(
  source,
  /function handleTypeFilterPick\(typeKey\) \{\n\s*setBrowserType\(typeKey\);\n\s*setBrowserCategory\(null\);\n\s*\}/,
  'Selecting a type must clear any selected category without activating the visible All chip.',
);
assert.match(
  source,
  /\.filter\(\(item\) => !browserCategory \|\| browserCategory === 'all' \|\|/,
  'The neutral category state must leave type-only filtering unconstrained by category.',
);
assert.match(
  source,
  /onClick=\{\(\) => handleCategoryFilterPick\(categoryKey\)\} aria-pressed=\{browserCategory === categoryKey\}/,
  'Category chips must expose their exclusive selected state.',
);
assert.match(
  source,
  /onClick=\{\(\) => handleTypeFilterPick\(typeKey\)\} aria-pressed=\{browserType === typeKey\}/,
  'Type chips must expose their exclusive selected state.',
);

console.log('[PASS] Add Shoes filter selection guardrails passed.');
