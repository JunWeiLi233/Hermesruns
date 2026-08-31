import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const componentSource = readFileSync(path.join(here, 'ShoeBrandLogo.jsx'), 'utf8');

// The Add Shoes redesign promotes previously-fallback brands to real shipped SVG logos.
// These brands now have dedicated imports in ShoeBrandLogo.jsx.
for (const promotedBrand of ['anta', 'bmai', 'do-win', 'lining', 'peak', 'hoka', 'brooks', 'on', 'dayan', 'volanti', 'haier', 'sonic-cat', 'veirun', 'pelliot', 'tracksmith']) {
  assert.match(
    componentSource,
    new RegExp(`import\\s+\\w+\\s+from\\s+['"][^'"]*${promotedBrand}(?:-\\w+)?\\.(svg|png|jpg|webp)['"]`),
    `ShoeBrandLogo should ship a real logo asset for the promoted ${promotedBrand} brand.`,
  );
}

assert.match(
  componentSource,
  /import\s+pairanshaoLogo\s+from\s+['"][^'"]*pairanshao-user\.webp['"];/,
  'ShoeBrandLogo should ship the supplied real logo asset for 派燃烧.',
);
assert.match(
  componentSource,
  /派燃烧:\s*pairanshaoLogo,/,
  'ShoeBrandLogo should resolve 派燃烧 to its supplied logo asset.',
);

assert.match(
  componentSource,
  /haier:\s*haierLogo,/,
  'ShoeBrandLogo should map the Haiers catalog key to the supplied local asset.',
);

assert.match(
  componentSource,
  /import\s+tanSheZheLogo\s+from\s+['"][^'"]*tanshezhe-user\.webp['"];/,
  'ShoeBrandLogo should import the supplied 弹射者 logo asset.',
);
assert.match(
  componentSource,
  /弹射者:\s*tanSheZheLogo,/,
  'ShoeBrandLogo should resolve 弹射者 to the supplied logo asset.',
);

assert.match(
  componentSource,
  /return \{\s*\[cssVarName\]: `url\("\$\{buildFallbackBrandDataUrl\(spec\)\}"\)`/,
  'ShoeBrandLogo background styles should fall back to generated SVG data URLs when a bundled logo asset is unavailable.',
);

console.log('[PASS] Shoe brand logo fallback guardrails passed.');
