import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const styleSource = readFileSync(path.join(here, "../../../styles/all-pages-liquid-glass.css"), 'utf8');

assert.match(
  styleSource,
  /#root \.runner-shell-page\.runs-dashboard-page \.runs-profile-workbench \.recent-runs-search-input:focus\s*\{[\s\S]*border:\s*0\s*!important;[\s\S]*outline:\s*none\s*!important;[\s\S]*box-shadow:\s*none\s*!important;/,
  'Runs search input focus should not render a red input border or focus ring.',
);

assert.match(
  styleSource,
  /#root \.runner-shell-page\.runs-dashboard-page \.runs-profile-workbench \.recent-runs-search-input-wrap:focus-within\s*\{[\s\S]*border-color:\s*var\(--runs-profile-line\)\s*!important;[\s\S]*box-shadow:/,
  'Runs search wrapper focus should preserve its normal light surface instead of the red accent state.',
);

console.log('[PASS] Runs search focus style guardrails passed.');
