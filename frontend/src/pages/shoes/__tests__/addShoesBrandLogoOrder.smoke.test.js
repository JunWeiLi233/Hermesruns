import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const pageSource = readFileSync(path.join(currentDir, "../AddShoes.jsx"), 'utf8');
const logoSource = readFileSync(path.join(currentDir, "../../../components/ShoeBrandLogo.jsx"), 'utf8');
const mountToCoastAsset = readFileSync(path.join(currentDir, "../../../assets/brand-logos/mount-to-coast.webp"));
const kailasAsset = readFileSync(path.join(currentDir, "../../../assets/brand-logos/kailas-reference.webp"));

assert.match(
  logoSource,
  /export function hasShoeBrandLogo\(brand\)/,
  'ShoeBrandLogo should expose the canonical real-logo availability check.',
);
assert.match(
  logoSource,
  /import mountToCoastLogo from ['"]\.\.\/assets\/brand-logos\/mount-to-coast\.webp['"];?/,
  'ShoeBrandLogo should import the supplied Mount to Coast logo asset.',
);
assert.match(
  logoSource,
  /mounttocoast:\s*mountToCoastLogo/,
  'The normalized Mount to Coast brand key should resolve to the supplied logo.',
);
for (const [asset, label] of [[mountToCoastAsset, 'Mount to Coast'], [kailasAsset, 'Kailas']]) {
  assert.equal(asset.subarray(0, 4).toString('ascii'), 'RIFF', `${label} should remain a valid WebP asset.`);
  assert.equal(asset.subarray(8, 12).toString('ascii'), 'WEBP', `${label} should use WebP encoding.`);
}
assert.match(
  logoSource,
  /import kailasLogo from ['"]\.\.\/assets\/brand-logos\/kailas-reference\.webp['"];?/,
  'ShoeBrandLogo should import the supplied Kailas logo asset.',
);
assert.match(
  logoSource,
  /kailas:\s*kailasLogo/,
  'The normalized Kailas brand key should resolve to the supplied logo.',
);
assert.match(
  pageSource,
  /import ShoeBrandLogo, \{ hasShoeBrandLogo \} from ['"]\.\.\/\.\.\/components\/ShoeBrandLogo['"];?/,
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
