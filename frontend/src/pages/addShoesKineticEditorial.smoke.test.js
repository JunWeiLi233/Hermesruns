import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const addShoesSource = readFileSync(path.join(here, 'AddShoes.jsx'), 'utf8');
const styleSource = readFileSync(path.join(here, '../styles/style.css'), 'utf8');

assert.match(
  addShoesSource,
  /add-shoes-editorial-hero/,
  'Add Shoes should expose a dedicated editorial hero shell.',
);

assert.match(
  addShoesSource,
  /add-shoes-brand-deck/,
  'Add Shoes should expose a stronger brand deck stage.',
);

assert.match(
  addShoesSource,
  /add-shoes-brand-expand-shell/,
  'Add Shoes should expose an expandable extra-brand section for less-common brands.',
);

assert.match(
  addShoesSource,
  /FEATURED_DECK_SECONDARY_COUNT\s*=\s*8/,
  'Add Shoes should show eight secondary brand cards next to the active featured brand.',
);

assert.match(
  addShoesSource,
  /for\s*\(\s*const\s+catalogBrand\s+of\s+shoeCatalog\s*\)/,
  'Add Shoes expandable brand section should derive more running brands from shoeCatalog order.',
);

assert.doesNotMatch(
  addShoesSource,
  /EXTRA_BRAND_KEYS/,
  'Add Shoes should not limit expanded brands to a short hard-coded key list.',
);

assert.match(
  addShoesSource,
  /add-shoes-model-board/,
  'Add Shoes should expose a premium model board instead of only a generic grid shell.',
);

assert.match(
  addShoesSource,
  /add-shoes-setup-payload/,
  'Add Shoes should expose a setup payload panel for the final configuration step.',
);

assert.doesNotMatch(
  addShoesSource,
  /add-shoes-brand-deck-feature-art/,
  'Add Shoes should not render the old separate feature-art badge anymore.',
);

assert.match(
  styleSource,
  /\.add-shoes-editorial-hero\s*\{/,
  'Add Shoes styles should define the editorial hero shell.',
);

assert.match(
  styleSource,
  /\.add-shoes-brand-deck\s*\{/,
  'Add Shoes styles should define the brand deck shell.',
);

assert.match(
  styleSource,
  /\.add-shoes-brand-expand-btn\s*\{/,
  'Add Shoes styles should define the expandable extra-brand toggle.',
);

assert.match(
  styleSource,
  /\.add-shoes-model-board\s*\{/,
  'Add Shoes styles should define the premium model board shell.',
);

assert.match(
  styleSource,
  /\.add-shoes-setup-payload\s*\{/,
  'Add Shoes styles should define the setup payload shell.',
);

assert.doesNotMatch(
  addShoesSource,
  /getShoeBrandLogoBackgroundStyle/,
  'Add Shoes should not paint raw logo assets as CSS background layers behind the visible brand logo.',
);

assert.doesNotMatch(
  styleSource,
  /--add-shoes-brand-bg-image/,
  'Add Shoes styles should not rely on the raw brand asset background variable, because that reintroduces leftover image backgrounds.',
);

console.log('[PASS] Add Shoes kinetic editorial guardrails passed.');
