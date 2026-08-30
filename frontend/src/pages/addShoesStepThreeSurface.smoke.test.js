import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const styles = readFileSync(path.join(here, '../styles/add-shoes-profile-alignment.css'), 'utf8');

assert.match(
  styles,
  /#root \.add-shoes-profile-redesign \.add-shoes-setup-payload\s*\{[^}]*background:\s*#fff !important;[^}]*background-image:\s*none !important;/,
  'The Step 3 configuration card should use a flat white background.',
);

console.log('[PASS] Add Shoes Step 3 uses a white surface.');
