import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const source = readFileSync(path.join(here, "../ShoeCatalog.jsx"), 'utf8');

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

assert.match(
  source,
  /import ShoeBrandLogo from '\.\.\/\.\.\/components\/ShoeBrandLogo';/,
  'ShoeCatalog should use the shared brand-logo resolver used by Add Shoes.',
);

assert.doesNotMatch(
  source,
  /function BrandLogo|function brandLogoSpec/,
  'ShoeCatalog should not maintain a second synthetic brand-logo implementation.',
);

console.log('[PASS] ShoeCatalog search preserves selected brand guard passed.');
