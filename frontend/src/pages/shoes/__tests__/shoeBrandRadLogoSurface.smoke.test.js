import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const logoSource = readFileSync(path.join(here, "../../../components/ShoeBrandLogo.jsx"), 'utf8');
const assetPath = path.join(here, "../../../assets/brand-logos/rad-reference.webp");

assert.match(
  logoSource,
  /import radLogo from ['"]\.\.\/assets\/brand-logos\/rad-reference\.webp['"];/,
  'R.A.D should use the supplied logo asset.',
);
assert.match(
  logoSource,
  /rad:\s*radLogo/,
  'The normalized R.A.D brand key should resolve to the supplied logo.',
);
assert.equal(existsSync(assetPath), true, 'The supplied R.A.D logo asset should exist.');

console.log('[PASS] R.A.D logo asset mapping guard passed.');
