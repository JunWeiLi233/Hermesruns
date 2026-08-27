import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const gestureSource = readFileSync(path.join(here, '../utils/catalogLongPress.js'), 'utf8');
const cardSource = readFileSync(path.join(here, '../components/CatalogLongPressCard.jsx'), 'utf8');
const dashboardSource = readFileSync(path.join(here, './Dashboard.jsx'), 'utf8');

assert.match(
  gestureSource,
  /if \(event\.target === event\.currentTarget\)\s*\{?\s*event\.currentTarget\?\.setPointerCapture\?\./,
  'Long-press cards should not capture the pointer when the press starts on a nested action button.',
);
assert.match(
  cardSource,
  /onClickCapture=\{\(event\) => \{[\s\S]*?gesture\.consumeClick\(event\)/,
  'Long-press cards should keep their click-suppression guard after a completed long press.',
);
assert.match(
  dashboardSource,
  /className=\{`admin-shoe-catalog-browser__brand\$\{isActive \? ' is-active' : ''\}`\}[\s\S]*?onClick=\{\(\) => setCatalogBrowserBrand\(brand\.brand\)\}/,
  'Brand cards should retain their brand-selection click handler.',
);

console.log('[PASS] Catalog card buttons remain clickable alongside long-press gestures.');
