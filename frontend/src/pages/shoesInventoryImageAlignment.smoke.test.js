import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, '..', '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

const shoesStyles = read('src/styles/_split/shoes.css');
const shoesPage = read('src/pages/Shoes.jsx');

const assertIncludes = (source, needle, label) => {
  if (!source.includes(needle)) {
    throw new Error(`${label} missing: ${needle}`);
  }
};

[
  'shoe-inventory-card-image',
  'shoe-img-clickable',
].forEach((className) => assertIncludes(shoesPage, className, 'Shoes page image hook'));

[
  '.shoe-inventory-card-image {',
  'display: grid;',
  'place-items: center;',
  '.shoe-inventory-card-image .shoe-img',
  'object-position: center;',
].forEach((selector) => assertIncludes(shoesStyles, selector, 'Shoe image alignment selector'));

console.log('shoesInventoryImageAlignment smoke test passed');
