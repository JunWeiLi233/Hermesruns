import assert from 'node:assert/strict';

import {
  getShoeBrandAssetKey,
  getShoeBrandFallbackSpec,
  normalizeShoeBrandKey,
} from './shoeBrandLogo.js';

assert.equal(
  normalizeShoeBrandKey(' New Balance! '),
  'newbalance',
  'Brand normalization should trim, lowercase, and remove punctuation.',
);

assert.equal(
  getShoeBrandAssetKey('鸿星尔克'),
  'erke',
  'Chinese ERKE aliases should resolve to the ERKE asset key.',
);

assert.equal(
  getShoeBrandAssetKey('彪马'),
  'puma',
  'Chinese Puma aliases should resolve to the Puma asset key.',
);

assert.equal(
  getShoeBrandAssetKey('特步'),
  'xtep',
  'Chinese Xtep aliases should resolve to the Xtep asset key.',
);

assert.equal(
  getShoeBrandAssetKey('361°'),
  '361',
  '361 degree branding should resolve to the shared 361 asset key.',
);

assert.equal(
  getShoeBrandAssetKey('沃兰迪'),
  'volanti',
  'The catalog spelling for Volanti should resolve to the official Volanti asset.',
);

assert.equal(
  getShoeBrandAssetKey('大鲶'),
  'dayan',
  'The Big Catfish catalog brand should resolve to its dedicated logo asset.',
);

assert.equal(
  getShoeBrandAssetKey('海尔斯'),
  'haier',
  'The Chinese Haiers catalog brand should resolve to its dedicated logo asset.',
);

assert.equal(
  getShoeBrandAssetKey('音速猫'),
  'soniccat',
  'The Chinese SonicCat catalog brand should resolve to its dedicated logo asset.',
);

assert.equal(
  getShoeBrandAssetKey('威量'),
  'veirun',
  'The Chinese Veirun catalog brand should resolve to its dedicated logo asset.',
);

assert.equal(
  getShoeBrandAssetKey('伯希和'),
  'pelliot',
  'The Chinese Pelliot catalog brand should resolve to its dedicated logo asset.',
);

assert.equal(
  getShoeBrandAssetKey('Tracksmith'),
  'tracksmith',
  'Tracksmith should resolve to its dedicated logo asset.',
);

assert.deepEqual(
  getShoeBrandFallbackSpec('Li-Ning'),
  {
    bg: '#dc2626',
    fg: '#ffffff',
    text: 'LI',
    fontSize: 13,
  },
  'Unknown-asset brands should still map to the expected fallback badge spec.',
);

assert.deepEqual(
  getShoeBrandFallbackSpec('  under armour  '),
  {
    bg: '#111827',
    fg: '#ffffff',
    text: 'UA',
    fontSize: 13,
  },
  'Alias normalization should preserve fallback badge behavior for Under Armour.',
);

assert.deepEqual(
  getShoeBrandFallbackSpec('音速猫'),
  {
    bg: '#111827',
    fg: '#ffffff',
    text: '音速猫',
    fontSize: 12,
  },
  'SonicCat should retain a deterministic fallback mark if its bundled image cannot load.',
);

for (const researchedBrand of [
  '海尔斯', '辛逸', '弹射者', '威量', '星火力', '领跑梦想',
  '燃动力', '天赐之翼', '双星', '双星八特', 'ONEMIX', 'FREETIE',
  '派燃烧', '强风跑霸', '申亚', '轻跑者', '喜得龙', 'R2 REALRUN',
]) {
  assert.ok(
    getShoeBrandFallbackSpec(researchedBrand),
    `${researchedBrand} should have a deterministic brand mark when no bundled image asset is available.`,
  );
}

assert.equal(
  getShoeBrandFallbackSpec('Mystery Brand'),
  null,
  'Unknown brands should not invent a fallback spec.',
);

console.log('[PASS] shoe brand logo utility coverage passed.');
