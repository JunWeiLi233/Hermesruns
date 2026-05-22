import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const source = readFileSync(path.join(here, 'ShoeCatalog.jsx'), 'utf8');

assert.match(
  source,
  /className="shoe-catalog-search-input"[\s\S]*setSearchQuery\(e\.target\.value\)/,
  'ShoeCatalog search input should update the model search query.',
);

assert.doesNotMatch(
  source,
  /if\s*\(\s*selectedBrand\s*\)\s*setSelectedBrand\(null\)/,
  'ShoeCatalog search should not clear the selected brand because the model grid only renders inside a brand selection.',
);

console.log('[PASS] ShoeCatalog search preserves selected brand guard passed.');
