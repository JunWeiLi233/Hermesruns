import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, "../../../..");
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

const shoesStyles = read('./src/styles/shoes-v2.css');
const shoesPage = read('./src/pages/shoes/Shoes.jsx');

const assertIncludes = (source, needle, label) => {
  if (!source.includes(needle)) {
    throw new Error(`${label} missing: ${needle}`);
  }
};

[
  'shoe-v2-photo',
  'shoe-img-clickable',
].forEach((className) => assertIncludes(shoesPage, className, 'Shoes page image hook'));

[
  '#root .shoe-v2-photo {',
  'display: grid;',
  'place-items: center;',
  '#root .shoe-v2-photo .shoe-img {',
  'object-position: center;',
].forEach((selector) => assertIncludes(shoesStyles, selector, 'Shoe image alignment selector'));

console.log('shoesInventoryImageAlignment smoke test passed');
