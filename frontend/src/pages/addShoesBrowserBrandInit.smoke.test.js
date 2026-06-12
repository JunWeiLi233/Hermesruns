import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const source = readFileSync(path.join(here, 'AddShoes.jsx'), 'utf8').replace(/\r\n/g, '\n');

const browserBrandDecl = source.indexOf('const browserBrand = useMemo(');
const browserBrandEffect = source.indexOf('useEffect(() => {\n    if (!browserBrand) return;');

assert.notStrictEqual(browserBrandDecl, -1, 'AddShoes should define browserBrand as a memoized value.');
assert.notStrictEqual(browserBrandEffect, -1, 'AddShoes should keep the extra-brand effect that reacts to browserBrand.');
assert.ok(
  browserBrandDecl < browserBrandEffect,
  'AddShoes must define browserBrand before any effect references it, or the page can crash in the temporal dead zone.',
);

console.log('[PASS] AddShoes browserBrand initialization guard passed.');
