import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const shoesSource = fs.readFileSync(path.join(here, "../Shoes.jsx"), 'utf8');
const brandLogoSource = fs.readFileSync(path.join(here, "../../../components/ShoeBrandLogo.jsx"), 'utf8');

assert.match(
  shoesSource,
  /function ProcessedDisplayImage\(\{[^}]*loading = 'lazy'[^}]*\}\)/,
  'Processed shoe images should keep a configurable loading policy for non-inventory surfaces.',
);
assert.match(
  shoesSource,
  /function ShoeImage\(\{ src, alt \}\)[\s\S]*?ProcessedDisplayImage[\s\S]*?loading="eager"/,
  'The Shoes inventory card image should load eagerly instead of triggering the browser lazy-image intervention.',
);
assert.match(
  shoesSource,
  /<ShoeBrandLogo\s+brand=\{shoe\.brand\}[\s\S]*?loading="eager"\s*\/>/,
  'The Shoes inventory brand logo should load eagerly with the card image.',
);
assert.match(
  brandLogoSource,
  /export default function ShoeBrandLogo\(\{[^}]*loading = 'lazy'[^}]*\}\)/,
  'Shared brand logos should retain lazy loading by default outside the Shoes inventory page.',
);
assert.match(
  brandLogoSource,
  /loading=\{loading\}/,
  'Shared brand logos should honor the page-specific loading policy.',
);

console.log('[PASS] Shoes image loading policy guardrails passed.');
