import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const styles = readFileSync(path.join(here, '../styles/add-shoes-profile-alignment.css'), 'utf8');

assert.match(
  styles,
  /body:is\(\.theme-light, \.theme-high-contrast-light\) #root \.add-shoes-profile-redesign \.add-shoes-brand-deck-feature\s*\{[\s\S]*?background:\s*rgba\(255, 255, 255, 0\.42\)\s*!important;[\s\S]*?color:\s*var\(--profile-ink\)\s*!important;/,
  'The featured brand card should share the normal brand-card light surface.',
);

assert.match(
  styles,
  /body:is\(\.theme-light, \.theme-high-contrast-light\) #root \.add-shoes-profile-redesign \.add-shoes-brand-deck-feature-copy strong\s*\{[\s\S]*?color:\s*var\(--profile-ink\)\s*!important;/,
  'The featured brand title should remain readable on the shared light surface.',
);

assert.match(
  styles,
  /body:is\(\.theme-light, \.theme-high-contrast-light\) #root \.add-shoes-profile-redesign \.add-shoes-brand-deck-feature-copy span,[\s\S]*?\.add-shoes-brand-deck-feature-copy p\s*\{[\s\S]*?color:\s*var\(--profile-muted\)\s*!important;/,
  'The featured brand supporting copy should match normal light-card copy.',
);

console.log('[PASS] Add Shoes featured brand card matches the normal light brand-card surface.');
