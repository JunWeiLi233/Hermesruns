import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const atelier = readFileSync(path.join(here, '../styles/shoes-atelier-redesign.css'), 'utf8');
const shoesSource = readFileSync(path.join(here, './Shoes.jsx'), 'utf8');

// The shoe card markup stacks card-top (art/copy/side row) → metrics →
// actions. The atelier 3-track card grid assumed the old flat
// structure and squeezed the whole card-top into one narrow column.
assert.match(
  shoesSource,
  /shoe-inventory-card-top[\s\S]*?shoe-inventory-card-art[\s\S]*?shoe-inventory-card-copy[\s\S]*?shoe-inventory-card-side/,
  'Shoe card markup should wrap art/copy/side inside card-top.',
);
assert.match(
  atelier,
  /#root \.shoes-atelier-redesign \.shoe-inventory-card\s*\{[^}]*grid-template-columns:\s*minmax\(0, 1fr\)/,
  'Atelier card should stack rows in a single column.',
);
assert.doesNotMatch(
  atelier,
  /\.shoe-inventory-card\s*\{[^}]*grid-template-columns:\s*1\d\dpx/,
  'The atelier stylesheet should not keep a pixel-leading card grid track.',
);
