import assert from 'node:assert/strict';

import shoeCatalog, { brandNames } from '../../../data/shoeCatalog.js';

const removedBrands = [
  '燃动力', '辛逸', '强风跑霸', '赛琪', 'ONEMIX', '轻跑者', 'NNormal', '天赐之翼', '星火力',
  'VJ', '双星', '双星八特', '思凯乐',
];

for (const brand of removedBrands) {
  assert.equal(
    brandNames.includes(brand),
    false,
    `${brand} should not be offered in the running-shoe brand catalog.`,
  );
  assert.equal(
    shoeCatalog.some((entry) => entry.brand === brand),
    false,
    `${brand} should not have a built-in running-shoe catalog entry.`,
  );
}

console.log('[PASS] Removed running-shoe brand catalog guard passed.');
