import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const read = (relativePath) => readFileSync(path.join(here, relativePath), 'utf8');
const source = read('Shoes.jsx');
const whiteSurfaceStyles = read('../styles/grid-cards-white.css');

assert.match(source, /className="shoe-photo-studio-hero"/, 'Shoes photo modal should keep its hero grid hook');
assert.match(
  whiteSurfaceStyles,
  /body:is\(\.theme-light, \.theme-high-contrast-light\) #root \.shoe-photo-modal-card\s*\{[\s\S]*background: #fff !important;[\s\S]*background-image: none !important;/,
  'Shoes photo modal should use a solid white light-theme surface',
);
assert.match(
  whiteSurfaceStyles,
  /body:is\(\.theme-light, \.theme-high-contrast-light\) #root \.shoe-photo-modal-card \.shoe-photo-studio-hero\s*\{[\s\S]*background: #fff !important;[\s\S]*background-image: none !important;/,
  'Shoes photo modal hero grid should use a solid white light-theme surface',
);
assert.match(
  whiteSurfaceStyles,
  /body:is\(\.theme-light, \.theme-high-contrast-light\) #root \.shoe-photo-modal-card \.shoe-photo-studio-input\s*\{[\s\S]*background: #eef0f1 !important;[\s\S]*background-image: none !important;/,
  'Shoes photo modal inputs should use a light-grey light-theme surface',
);
assert.match(
  whiteSurfaceStyles,
  /body:is\(\.theme-light, \.theme-high-contrast-light\) #root \.shoe-photo-modal-card \.shoe-photo-studio-title h3\s*\{[\s\S]*color: var\(--runner-profile-ink, #2c2f30\) !important;/,
  'Shoes photo modal hero title should remain readable on the white surface',
);
assert.match(
  whiteSurfaceStyles,
  /body:is\(\.theme-light, \.theme-high-contrast-light\) #root \.shoe-photo-modal-card \.shoe-photo-studio-hero::after\s*\{[\s\S]*content: none !important;[\s\S]*display: none !important;[\s\S]*background: none !important;/,
  'Shoes photo modal hero should not render the decorative circle on the white surface',
);
assert.match(
  whiteSurfaceStyles,
  /body:is\(\.theme-light, \.theme-high-contrast-light\) #root \.shoe-photo-modal-card \.shoe-photo-studio-upload\s*\{[\s\S]*background: #eef0f1 !important;[\s\S]*background-image: none !important;/,
  'Shoes photo modal local-upload card should use a solid light-grey surface',
);

console.log('shoesPhotoModalWhiteSurface smoke test passed');
