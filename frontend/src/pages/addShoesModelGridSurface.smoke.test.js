import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const styles = readFileSync(path.join(here, '../styles/add-shoes-profile-alignment.css'), 'utf8');

assert.match(
  styles,
  /#root \.add-shoes-profile-redesign \.add-shoes-model-board\s*\{[^}]*background:\s*#fff !important;/,
  'The Step 2 model-board section should use a solid white background.',
);
assert.match(
  styles,
  /#root \.add-shoes-profile-redesign \.add-shoes-model-board\s*\{[^}]*background-image:\s*none !important;/,
  'The Step 2 model-board section should not retain a background gradient.',
);
assert.match(
  styles,
  /#root \.add-shoes-profile-redesign \.add-shoes-model-board-shell\s*\{[^}]*?background:\s*#fff !important;/,
  'The Step 2 model-board shell should use a solid white background.',
);
assert.match(
  styles,
  /#root \.add-shoes-profile-redesign \.add-shoes-model-board \.add-shoes-model-grid\s*\{[^}]*?background:\s*#fff !important;/,
  'The Step 2 model grid should use a solid white background.',
);

console.log('[PASS] Add Shoes model grid uses a white surface.');
