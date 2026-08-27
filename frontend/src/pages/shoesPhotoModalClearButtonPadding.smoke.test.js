import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const read = (relativePath) => readFileSync(path.join(here, relativePath), 'utf8');
const source = read('Shoes.jsx');
const styles = read('../styles/shoes-atelier-redesign.css');

assert.match(
  source,
  /className="shoe-photo-studio-clear"[\s\S]*?t\('shoes\.img_clear'\)/,
  'The shoe image picker should keep the clear-image action wired to its localized label.',
);
assert.match(
  styles,
  /#root \.shoe-photo-studio-clear\s*\{[\s\S]*?padding-inline:\s*14px;/,
  'The clear-image action should reserve horizontal padding on both sides of its label.',
);

console.log('[PASS] Shoe image picker clear button keeps balanced horizontal padding.');
