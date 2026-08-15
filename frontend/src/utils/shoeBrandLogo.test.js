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

assert.equal(
  getShoeBrandFallbackSpec('Mystery Brand'),
  null,
  'Unknown brands should not invent a fallback spec.',
);

console.log('[PASS] shoe brand logo utility coverage passed.');
