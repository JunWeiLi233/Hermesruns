import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const styles = readFileSync(path.join(here, "../../../styles/add-shoes-profile-alignment.css"), 'utf8');

assert.match(
  styles,
  /#root \.add-shoes-profile-redesign :is\(\s*\.add-shoes-brand-card-copy,\s*\.add-shoes-brand-card-copy strong,\s*\.add-shoes-brand-card-copy span\s*\)\s*\{[\s\S]*?background:\s*transparent !important;[\s\S]*?background-color:\s*transparent !important;[\s\S]*?background-image:\s*none !important;[\s\S]*?border:\s*0 !important;[\s\S]*?box-shadow:\s*none !important;/m,
  'Add Shoes brand copy and its text children should not render a panel strip.',
);

console.log('[PASS] Add Shoes brand copy surface guardrail passed.');
