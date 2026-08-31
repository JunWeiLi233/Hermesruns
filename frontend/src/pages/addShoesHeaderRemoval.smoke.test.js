import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const pageSource = readFileSync(path.join(here, 'AddShoes.jsx'), 'utf8');

assert.doesNotMatch(pageSource, /add-shoes-stage-head|add-shoes-stage-copy/, 'The redundant Add Shoes browser heading block should be removed.');
assert.doesNotMatch(pageSource, /t\('shoes\.browser_kicker'\)/, 'The redundant browser kicker should not render on /shoes/add.');
assert.doesNotMatch(pageSource, /const browserTitle =/, 'The removed heading should not leave an unused browser title value.');
assert.match(pageSource, /add-shoes-step-card/, 'The Step 1 brand picker should remain on /shoes/add.');
assert.match(pageSource, /browserModelPlaceholder/, 'The model search control should remain on /shoes/add.');

console.log('[PASS] Add Shoes redundant browser heading removal guard passed.');
