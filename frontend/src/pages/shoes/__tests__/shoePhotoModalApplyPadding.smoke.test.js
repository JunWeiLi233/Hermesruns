import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const styles = readFileSync(path.join(here, "../../../styles/shoes-atelier-redesign.css"), 'utf8');

assert.match(
  styles,
  /#root \.shoe-photo-studio-inline-row \.shoe-photo-studio-primary-btn\s*\{[\s\S]*?padding-inline:\s*16px;/,
  'The shoes photo modal inline action should have horizontal padding around its label.',
);

console.log('[PASS] Shoes photo modal apply-button spacing guardrail passed.');
