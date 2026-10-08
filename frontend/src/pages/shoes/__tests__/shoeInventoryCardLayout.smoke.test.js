import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const shelf = readFileSync(path.join(here, "../../../styles/shoes-v2.css"), 'utf8');
const shoesSource = readFileSync(path.join(here, "../Shoes.jsx"), 'utf8');

// Keep media above the card details and preserve the full-width grid at all sizes.
assert.match(
  shoesSource,
  /shoe-v2-media[\s\S]*?shoe-v2-photo[\s\S]*?shoe-v2-body[\s\S]*?shoe-v2-mileage/,
  'Shoe cards should stack the photo above their details and mileage.',
);
assert.match(
  shelf,
  /\.shoe-inventory-card\.shoe-v2-card\s*\{[^}]*flex-direction:\s*column/,
  'Rotation cards should stack their media and details.',
);
assert.doesNotMatch(
  shelf,
  /\.shoe-inventory-card\s*\{[^}]*grid-template-columns:\s*1\d\dpx/,
  'The atelier stylesheet should not keep a pixel-leading card grid track.',
);
