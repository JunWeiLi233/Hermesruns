import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const componentSource = readFileSync(path.join(here, 'ShoeBrandLogo.jsx'), 'utf8');

// The Add Shoes redesign promotes previously-fallback brands to real shipped SVG logos.
// These brands now have dedicated imports in ShoeBrandLogo.jsx.
for (const promotedBrand of ['anta', 'bmai', 'do-win', 'lining', 'peak', 'hoka', 'brooks', 'on', 'dayan', 'volanti']) {
  assert.match(
    componentSource,
    new RegExp(`import\\s+\\w+\\s+from\\s+['"][^'"]*${promotedBrand}(?:-\\w+)?\\.(svg|png|jpg|webp)['"]`),
    `ShoeBrandLogo should ship a real logo asset for the promoted ${promotedBrand} brand.`,
  );
}

assert.match(
  componentSource,
  /return \{\s*\[cssVarName\]: `url\("\$\{buildFallbackBrandDataUrl\(spec\)\}"\)`/,
  'ShoeBrandLogo background styles should fall back to generated SVG data URLs when a bundled logo asset is unavailable.',
);

console.log('[PASS] Shoe brand logo fallback guardrails passed.');
