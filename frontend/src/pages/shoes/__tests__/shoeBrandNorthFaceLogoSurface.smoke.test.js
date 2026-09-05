import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const logoSource = readFileSync(path.join(here, "../../../components/ShoeBrandLogo.jsx"), 'utf8');
const assetPath = path.join(here, "../../../assets/brand-logos/the-north-face-reference.webp");

assert.match(
  logoSource,
  /import northFaceLogo from ['"]\.\.\/assets\/brand-logos\/the-north-face-reference\.webp['"];/,
  'The North Face should use the supplied logo asset.',
);
assert.match(
  logoSource,
  /thenorthface:\s*northFaceLogo/,
  'The normalized The North Face brand key should resolve to the supplied logo.',
);
assert.equal(existsSync(assetPath), true, 'The supplied The North Face logo asset should exist.');

console.log('[PASS] The North Face logo asset mapping guard passed.');
