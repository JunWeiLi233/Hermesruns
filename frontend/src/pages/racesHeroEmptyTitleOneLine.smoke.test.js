import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const styleSource = readFileSync(path.join(here, '..', 'styles', '_split', 'races.css'), 'utf8');
const gridCardsWhiteSource = readFileSync(path.join(here, '..', 'styles', 'grid-cards-white.css'), 'utf8');

assert.match(
  styleSource,
  /\.race-center-hero\s+h1\.race-center-hero-title--empty\s*\{\s*max-width:\s*none;\s*white-space:\s*nowrap;\s*font-size:\s*clamp\(2rem,\s*7vw,\s*6\.1rem\);\s*\}/,
  'The empty race hero title should stay on one line and scale to the available width.',
);

assert.match(
  styleSource,
  /@media\s*\(max-width:\s*720px\)[\s\S]*?\.race-center-hero\s+h1\.race-center-hero-title--empty\s*\{\s*max-width:\s*100%;\s*font-size:\s*clamp\(1\.7rem,\s*8vw,\s*3\.4rem\);\s*\}/,
  'The empty race hero title should remain visible on narrow mobile screens.',
);

assert.match(
  gridCardsWhiteSource,
  /body:is\(\.theme-light, \.theme-high-contrast-light\) #root \.races-dashboard-page \.race-center-hero h1\.race-center-hero-title--empty\s*\{\s*color:\s*#000 !important;/,
  'The empty race hero title should use black text in light themes.',
);

console.log('[PASS] Races empty hero title one-line guard passed.');
