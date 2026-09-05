import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const styles = readFileSync(path.join(here, "../../../styles/add-shoes-profile-alignment.css"), 'utf8');

assert.match(
  styles,
  /body:is\(\.theme-light, \.theme-high-contrast-light\) #root \.add-shoes-profile-redesign \.add-shoes-selected-summary\s*\{[\s\S]*?background:\s*#fff\s*!important;/,
  'The selected-shoe summary should use a white light-theme surface.',
);

assert.match(
  styles,
  /body:is\(\.theme-light, \.theme-high-contrast-light\) #root \.add-shoes-profile-redesign \.add-shoes-selected-summary strong\s*\{[\s\S]*?color:\s*var\(--profile-ink\)\s*!important;/,
  'The selected-shoe summary title should remain readable on white.',
);

assert.match(
  styles,
  /body:is\(\.theme-light, \.theme-high-contrast-light\) #root \.add-shoes-profile-redesign \.add-shoes-selected-summary p\s*\{[\s\S]*?color:\s*var\(--profile-muted\)\s*!important;/,
  'The selected-shoe summary copy should remain readable on white.',
);

console.log('[PASS] Add Shoes selected summary uses a readable white light-theme surface.');
