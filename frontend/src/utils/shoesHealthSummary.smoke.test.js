/**
 * Smoke test: Shoes health summary row is wired into the locker.
 *
 * Verifies that:
 * 1. Shoes.jsx uses the shoe-health-summary-row class (the summary row exists).
 * 2. Shoes.jsx references the health_summary_active translation key.
 * 3. Shoes.jsx references the health_summary_retire_soon key.
 * 4. The brand filter state and locker brand bar are present.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
const shoesSource = readFileSync(path.join(here, '..', 'pages', 'Shoes.jsx'), 'utf8');

assert.match(
  shoesSource,
  /shoe-health-summary-row/,
  'Shoes.jsx should render the shoe-health-summary-row element.'
);

assert.match(
  shoesSource,
  /t\('shoes\.health_summary_active'/,
  'Shoes.jsx should use the health_summary_active translation key.'
);

assert.match(
  shoesSource,
  /t\('shoes\.health_summary_retire_soon'/,
  'Shoes.jsx should use the health_summary_retire_soon translation key.'
);

assert.match(
  shoesSource,
  /lockerBrandFilter/,
  'Shoes.jsx should have a lockerBrandFilter state for brand filtering.'
);

assert.match(
  shoesSource,
  /shoe-locker-brandbar/,
  'Shoes.jsx should render the shoe-locker-brandbar for owned-brand filtering.'
);

console.log('[PASS] Shoes health summary + brand filter smoke test passed.');
