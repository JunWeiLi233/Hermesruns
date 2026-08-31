import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const pageSource = readFileSync(path.join(currentDir, 'AddShoes.jsx'), 'utf8');
const logoSource = readFileSync(path.join(currentDir, '../components/ShoeBrandLogo.jsx'), 'utf8');
const mountToCoastAsset = readFileSync(path.join(currentDir, '../assets/brand-logos/mount-to-coast.png'));
const kailasAsset = readFileSync(path.join(currentDir, '../assets/brand-logos/kailas-reference.png'));

assert.match(
  logoSource,
  /export function hasShoeBrandLogo\(brand\)/,
  'ShoeBrandLogo should expose the canonical real-logo availability check.',
);
assert.match(
  logoSource,
  /import mountToCoastLogo from ['"]\.\.\/assets\/brand-logos\/mount-to-coast\.png['"];?/,
  'ShoeBrandLogo should import the supplied Mount to Coast logo asset.',
);
assert.match(
  logoSource,
  /mounttocoast:\s*mountToCoastLogo/,
  'The normalized Mount to Coast brand key should resolve to the supplied logo.',
);
assert.equal(
  mountToCoastAsset.subarray(0, 8).toString('hex'),
  '89504e470d0a1a0a',
  'The Mount to Coast logo should remain a valid PNG asset.',
);
assert.equal(
  mountToCoastAsset[25],
  6,
  'The Mount to Coast logo should use PNG RGBA color type for transparency.',
);
assert.match(
  logoSource,
  /import kailasLogo from ['"]\.\.\/assets\/brand-logos\/kailas-reference\.png['"];?/,
  'ShoeBrandLogo should import the supplied Kailas logo asset.',
);
assert.match(
  logoSource,
  /kailas:\s*kailasLogo/,
  'The normalized Kailas brand key should resolve to the supplied logo.',
);
assert.equal(
  kailasAsset.subarray(0, 8).toString('hex'),
  '89504e470d0a1a0a',
  'The Kailas logo should remain a valid PNG asset.',
);
assert.match(
  pageSource,
  /import ShoeBrandLogo, \{ hasShoeBrandLogo \} from ['"]\.\.\/components\/ShoeBrandLogo['"];?/,
  'Add Shoes should use the shared logo resolver when ordering brands.',
);
assert.match(
  pageSource,
  /Number\(hasShoeBrandLogo\(b\)\)\s*-\s*Number\(hasShoeBrandLogo\(a\)\)/,
  'Brands with real logos should sort ahead of fallback-only brands.',
);
assert.match(
  pageSource,
  /Number\(b\.models\?\.length\s*\|\|\s*0\)\s*-\s*Number\(a\.models\?\.length\s*\|\|\s*0\)/,
  'Brand model-count ordering should remain the tie-breaker within logo groups.',
);
assert.match(
  pageSource,
  /const extraBrands = useMemo\(\(\) => \{[\s\S]*?return browserBrands\.filter\(/,
  'Expanded brands should reuse the same logo-first ordering as the initial grid.',
);
assert.match(
  pageSource,
  /<ShoeBrandLogo[\s\S]*logoUrl=\{(?:featuredBrand|brand)\.logoUrl\}/,
  'Brand cards should pass explicit backend logo URLs to the shared logo component.',
);

console.log('[PASS] Add Shoes brand logo ordering guardrails passed.');
