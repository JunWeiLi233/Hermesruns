import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const read = (relativePath) => readFileSync(path.join(here, relativePath), 'utf8');
const source = read('../Shoes.jsx');
const styles = read('../../../styles/shoe-photo-picker-v2.css');

assert.match(
  source,
  /className="shoe-photo-picker-text-btn is-muted"[^>]*onClick=\{clearImage\}[\s\S]*?t\('shoes\.img_remove'\)/,
  'The shoe image picker should keep the remove-image action wired to its localized label.',
);
assert.match(
  styles,
  /#root \.shoe-photo-picker-footer\s*\{[^}]*padding:\s*16px 24px;/,
  'The picker footer should reserve padding around its text actions.',
);

console.log('[PASS] Shoe image picker clear button keeps balanced horizontal padding.');
