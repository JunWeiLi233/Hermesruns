import assert from 'node:assert/strict';

import { buildSeriesCatalog, mergeShoeCatalog, readLocalSeriesCatalog } from './addShoeCatalog.js';

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

const merged = mergeShoeCatalog(
  [{ brand: 'Nike', logo: 'N', models: [{ model: 'Pegasus', type: 'daily', category: 'trainer' }] }],
  {
    brands: [
      { brand: 'Nike', models: [{ id: 41, model: 'Pegasus', type: 'daily', modelEn: 'Pegasus Runner' }] },
      { brand: 'Topo Athletic', models: [{ id: 99, model: 'Pursuit', type: 'daily' }] },
    ],
  },
);

assert.equal(merged.find((entry) => entry.brand === 'Nike').models[0].id, 41);
assert.equal(merged.find((entry) => entry.brand === 'Nike').models[0].modelEn, 'Pegasus Runner');
assert.equal(merged.find((entry) => entry.brand === 'Nike').models[0].category, 'trainer');
assert.equal(merged.find((entry) => entry.brand === 'Topo Athletic').models[0].id, 99);
assert.equal(merged.find((entry) => entry.brand === 'Nike').models.length, 1);

console.log('[PASS] Shared admin and runner shoe catalog merge passed.');

const removedFromCache = buildSeriesCatalog([
  { brand: '申亚', models: [{ model: '008' }] },
  { brand: '强风跑霸', models: [{ model: '风速' }] },
  { brand: '赛琪', models: [{ model: '巨风' }] },
  { brand: 'ONEMIX', models: [{ model: '劲飞爽' }] },
  { brand: 'NNormal', models: [{ model: 'Kjerag' }] },
  { brand: '轻跑者', models: [{ model: '锋刃' }] },
  { brand: '天赐之翼', models: [{ model: '宙斯' }] },
  { brand: '星火力', models: [{ model: '音速' }] },
  { brand: 'Nike', models: [{ model: 'Pegasus' }] },
]);
assert.equal(removedFromCache.some((entry) => entry.brand === '申亚'), false);
assert.equal(removedFromCache.some((entry) => entry.brand === '强风跑霸'), false);
assert.equal(removedFromCache.some((entry) => entry.brand === '赛琪'), false);
assert.equal(removedFromCache.some((entry) => entry.brand === 'ONEMIX'), false);
assert.equal(removedFromCache.some((entry) => entry.brand === 'NNormal'), false);
assert.equal(removedFromCache.some((entry) => entry.brand === '轻跑者'), false);
assert.equal(removedFromCache.some((entry) => entry.brand === '天赐之翼'), false);
assert.equal(removedFromCache.some((entry) => entry.brand === '星火力'), false);

const cachedCatalog = readLocalSeriesCatalog({
  getItem: () => JSON.stringify([
    { brand: '德尔惠', models: [{ model: '裂空' }] },
    { brand: '强风跑霸', models: [{ model: '风速' }] },
    { brand: '赛琪', models: [{ model: '巨风' }] },
    { brand: 'ONEMIX', models: [{ model: '劲飞爽' }] },
    { brand: 'NNormal', models: [{ model: 'Kjerag' }] },
    { brand: '轻跑者', models: [{ model: '锋刃' }] },
    { brand: '天赐之翼', models: [{ model: '宙斯' }] },
    { brand: '星火力', models: [{ model: '音速' }] },
    { brand: 'Nike', models: [{ model: 'Pegasus' }] },
  ]),
});
assert.equal(cachedCatalog.some((entry) => entry.brand === '德尔惠'), false);
assert.equal(cachedCatalog.some((entry) => entry.brand === '强风跑霸'), false);
assert.equal(cachedCatalog.some((entry) => entry.brand === '赛琪'), false);
assert.equal(cachedCatalog.some((entry) => entry.brand === 'ONEMIX'), false);
assert.equal(cachedCatalog.some((entry) => entry.brand === 'NNormal'), false);
assert.equal(cachedCatalog.some((entry) => entry.brand === '轻跑者'), false);
assert.equal(cachedCatalog.some((entry) => entry.brand === '天赐之翼'), false);
assert.equal(cachedCatalog.some((entry) => entry.brand === '星火力'), false);

console.log('[PASS] Removed shoe brands stay out of cached runner catalog data.');
