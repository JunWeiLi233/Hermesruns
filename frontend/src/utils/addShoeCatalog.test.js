import assert from 'node:assert/strict';

import { buildSeriesCatalog } from './addShoeCatalog.js';

const catalog = [
  {
    brand: 'ASICS',
    models: [
      { model: 'Superblast', category: 'trainer', type: 'daily' },
      { model: 'Superblast 3', category: 'race', type: 'race' },
      { model: 'Novablast', category: 'trainer', type: 'daily' },
      { model: 'Novablast 5', category: 'trainer', type: 'daily' },
      { model: 'GT-2000', category: 'stability', type: 'stability' },
    ],
  },
  {
    brand: 'Nike',
    models: [
      { model: 'Vomero 18', category: 'cushion', type: 'daily' },
      { model: 'Alphafly', category: 'race', type: 'race' },
    ],
  },
];

const filtered = buildSeriesCatalog(catalog);
const asics = filtered.find((entry) => entry.brand === 'ASICS');
const nike = filtered.find((entry) => entry.brand === 'Nike');

assert.deepEqual(
  asics.models.map((item) => item.model),
  ['Superblast', 'Novablast', 'GT-2000'],
  'Add Shoes should hide numbered variants when the canonical series already exists for that brand.',
);

assert.deepEqual(
  nike.models.map((item) => item.model),
  ['Vomero 18', 'Alphafly'],
  'Add Shoes should keep models that do not have a canonical unnumbered sibling in the same brand.',
);

console.log('[PASS] Add shoe catalog series filtering passed.');
