import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const source = readFileSync(path.join(here, 'AddShoes.jsx'), 'utf8');
const styles = readFileSync(path.join(here, '../styles/add-shoes-profile-alignment.css'), 'utf8');

assert.doesNotMatch(source, /add-shoes-brand-deck-feature/, 'The featured brand should use the shared card markup.');
assert.match(
  styles,
  /#root \.add-shoes-profile-redesign \.add-shoes-brand-deck-card\.is-active\s*\{[\s\S]*?border:\s*1px solid var\(--profile-accent\) !important;[\s\S]*?background:\s*rgba\(255, 255, 255, 0\.42\) !important;[\s\S]*?box-shadow:\s*none !important;/,
  'The selected brand card should keep the normal surface with a red border on all four sides.',
);
assert.match(
  styles,
  /#root \.add-shoes-profile-redesign \.add-shoes-brand-card-copy\s*\{[\s\S]*?background:\s*transparent !important;[\s\S]*?box-shadow:\s*none !important;/,
  'Brand text should not render an extra panel strip behind the copy.',
);

console.log('[PASS] Add Shoes selected brand card matches the normal compact card surface.');
