import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const styles = readFileSync(path.join(here, '../styles/add-shoes-profile-alignment.css'), 'utf8');

assert.match(
  styles,
  /#root \.add-shoes-profile-redesign \.add-shoes-brand-card-copy\s*\{[^}]*display:\s*inline-flex;[^}]*align-items:\s*baseline;[^}]*gap:\s*6px;/m,
  'Add Shoes brand names and series counts should have a visible inline gap.',
);

console.log('[PASS] Add Shoes brand/count spacing guardrail passed.');
