import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const racesSource = readFileSync(path.join(here, 'Races.jsx'), 'utf8');
const liquidGlassStyleSource = readFileSync(path.join(here, '../styles/all-pages-liquid-glass.css'), 'utf8');

assert.match(
  racesSource,
  /className="race-center-card"[\s\S]*className="race-center-card-image-wrap"[\s\S]*className="race-center-card-body"[\s\S]*className="race-center-card-meta"[\s\S]*className="race-center-card-name"[\s\S]*className="race-center-card-location"[\s\S]*className="race-center-card-cta"/,
  'Race cards should keep their image, copy, and action hierarchy.',
);

assert.match(
  liquidGlassStyleSource,
  /\.runner-shell-page\.races-dashboard-page \.race-center-card :is\(\s*\.race-center-card-body,\s*\.race-center-card-meta,\s*\.race-center-card-distance,\s*\.race-center-card-month,\s*\.race-center-card-name,\s*\.race-center-card-location\s*\) \{\s*border-color: transparent !important;\s*background: transparent !important;\s*background-image: none !important;\s*box-shadow: none !important;/,
  'Race card copy should remain on its parent surface instead of rendering as nested glass strips.',
);

console.log('[PASS] Race card surface guardrails passed.');
