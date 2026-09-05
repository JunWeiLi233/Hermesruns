import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const routeStyleSource = readFileSync(path.join(here, "../../../styles/add-shoes-profile-alignment.css"), 'utf8');
const legacyStyleSource = readFileSync(path.join(here, "../../../styles/style.css"), 'utf8');

for (const [source, label] of [[routeStyleSource, 'route'], [legacyStyleSource, 'legacy']]) {
  assert.match(
    source,
    /\.add-shoes-search-row:focus-within\s*\{[\s\S]*?border-color:\s*(?:var\(--profile-line\)|var\(--profile-line\) !important);[\s\S]*?box-shadow:\s*none(?:\s*!important)?;/,
    `Add Shoes ${label} search wrapper should not paint an outside focus ring.`,
  );
  assert.match(
    source,
    /\.add-shoes-search-row input:focus-visible\s*\{[\s\S]*?outline:\s*2px solid var\(--profile-accent\)(?:\s*!important)?;[\s\S]*?outline-offset:\s*-2px;/,
    `Add Shoes ${label} search input should keep an inset focus indicator.`,
  );
}

console.log('[PASS] Add Shoes search focus ring guardrails passed.');
