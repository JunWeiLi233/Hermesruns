/**
 * Smoke test: Shoes health summary is wired into the rotation header.
 *
 * Verifies that:
 * 1. Shoes.jsx renders the rotation header.
 * 2. Shoes.jsx references the v2_active_pairs translation key.
 * 3. Shoes.jsx references the v2_retire_soon key.
 * 4. The brand filter state and select are present.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
const shoesSource = readFileSync(path.join(here, "../pages/shoes/Shoes.jsx"), 'utf8');

assert.match(
  shoesSource,
  /shoe-v2-head-copy/,
  'Shoes.jsx should render the rotation summary in the page header.'
);

assert.match(
  shoesSource,
  /t\('shoes\.v2_active_pairs'/,
  'Shoes.jsx should use the active-pairs summary translation key.'
);

assert.match(
  shoesSource,
  /t\('shoes\.v2_retire_soon'/,
  'Shoes.jsx should use the retiring-soon summary translation key.'
);

assert.match(
  shoesSource,
  /lockerBrandFilter/,
  'Shoes.jsx should have a lockerBrandFilter state for brand filtering.'
);

assert.match(
  shoesSource,
  /<select[^>]*value=\{lockerBrandFilter\}/,
  'Shoes.jsx should render a select for owned-brand filtering.'
);

console.log('[PASS] Shoes health summary + brand filter smoke test passed.');
