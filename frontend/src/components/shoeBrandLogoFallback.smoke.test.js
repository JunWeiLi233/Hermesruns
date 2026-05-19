import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const componentSource = readFileSync(path.join(here, 'ShoeBrandLogo.jsx'), 'utf8');

for (const missingAssetBrand of ['anta', 'bmai', 'do-win', 'lining', 'peak']) {
  assert.doesNotMatch(
    componentSource,
    new RegExp(`import\\s+\\w+\\s+from\\s+['"][^'"]*${missingAssetBrand}\\.(svg|png|jpg|webp)['"]`),
    `ShoeBrandLogo should not reintroduce a hard import for the missing ${missingAssetBrand} brand asset.`,
  );
}

assert.match(
  componentSource,
  /if \(key === 'hoka'\) return make\(\{ bg: '#22c55e', fg: '#ffffff', text: 'HOKA' \}\);/,
  'ShoeBrandLogo should keep a synthetic fallback spec for HOKA when no shipped asset exists.',
);

assert.match(
  componentSource,
  /if \(key === 'brooks'\) return make\(\{ bg: '#3b82f6', fg: '#ffffff', text: 'BROOKS' \}\);/,
  'ShoeBrandLogo should keep a synthetic fallback spec for Brooks when no shipped asset exists.',
);

assert.match(
  componentSource,
  /if \(key === 'on'\) return make\(\{ bg: '#e5e7eb', fg: '#0f172a', text: 'ON' \}\);/,
  'ShoeBrandLogo should keep a synthetic fallback spec for On when no shipped asset exists.',
);

assert.match(
  componentSource,
  /return \{\s*\[cssVarName\]: `url\("\$\{buildFallbackBrandDataUrl\(spec\)\}"\)`/,
  'ShoeBrandLogo background styles should fall back to generated SVG data URLs when a bundled logo asset is unavailable.',
);

console.log('[PASS] Shoe brand logo fallback guardrails passed.');
