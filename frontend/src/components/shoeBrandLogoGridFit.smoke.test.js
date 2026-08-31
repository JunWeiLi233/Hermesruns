import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const shoesStyles = readFileSync(path.join(here, '../styles/_split/shoes.css'), 'utf8');
const componentSource = readFileSync(path.join(here, 'ShoeBrandLogo.jsx'), 'utf8');
const addShoesStyles = readFileSync(path.join(here, '../styles/add-shoes-profile-alignment.css'), 'utf8');

assert.match(
  shoesStyles,
  /\.shoe-brand-logo-img\s*\{[^}]*box-sizing:\s*border-box;[^}]*max-width:\s*100%;[^}]*max-height:\s*100%;/s,
  'Shoe brand image logos should keep padding, borders, and their rendered size inside their fixed grid slot.',
);

assert.match(
  componentSource,
  /shoe-brand-logo-img--bmai/,
  'BMAI should have a dedicated raster-logo hook for its square grid treatment.',
);

assert.match(
  addShoesStyles,
  /:has\(> \.shoe-brand-logo-img--bmai\)[\s\S]*?padding:\s*0;[\s\S]*?overflow:\s*hidden;/,
  'BMAI brand and model tiles should let the square asset fill the available grid cell.',
);

assert.match(
  addShoesStyles,
  /\.add-shoes-brand-tile > \.shoe-brand-logo-img--bmai,[\s\S]*?\{[\s\S]*?width:\s*100%;[\s\S]*?height:\s*100%;/,
  'BMAI should use the full width and height of the grid tile.',
);

assert.match(
  shoesStyles,
  /\.add-shoes-brand-logo\s*\{[^}]*width:\s*44px;[^}]*height:\s*44px;[^}]*flex:\s*0 0 44px;[^}]*overflow:\s*hidden;/s,
  'Shoe Catalog brand logos should stay inside a fixed four-sided rail slot.',
);

console.log('[PASS] Shoe brand logo grid fit guard passed.');
