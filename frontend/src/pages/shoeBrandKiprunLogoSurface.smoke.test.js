import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const logoSource = readFileSync(path.join(here, '../components/ShoeBrandLogo.jsx'), 'utf8');
const assetPath = path.join(here, '../assets/brand-logos/kiprun-background-removed.png');

assert.match(
  logoSource,
  /import kiprunLogo from ['"]\.\.\/assets\/brand-logos\/kiprun-background-removed\.png['"];/,
  'KIPRUN should use the background-removed logo asset.',
);
assert.match(
  logoSource,
  /kiprun:\s*kiprunLogo/,
  'The normalized KIPRUN brand key should resolve to the background-removed logo.',
);
assert.match(
  logoSource,
  /shouldRemoveBackground = \[[^\]]*'kiprun'[^\]]*\]\.includes\(getShoeBrandAssetKey\(brand\)\)/,
  'Explicit KIPRUN logo URLs should use the same background-removal treatment.',
);
assert.doesNotMatch(
  logoSource,
  /import kiprunLogo from ['"]\.\.\/assets\/brand-logos\/kiprun-reference\.webp['"];/,
  'KIPRUN should not keep using the opaque reference asset.',
);
assert.equal(existsSync(assetPath), true, 'The transparent KIPRUN logo asset should exist.');

console.log('[PASS] KIPRUN logo background removal guard passed.');
