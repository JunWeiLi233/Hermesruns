import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const territorySource = readFileSync(path.join(here, 'Territory.jsx'), 'utf8');

// ── 1. Smoother camera ──────────────────────────────────────────────────────
// Initial camera placement should be instant and centered on the user's live
// territory center; explicit recenter actions should still animate to full bounds.
assert.match(
  territorySource,
  /if \(recenterSignal > 0\) \{[\s\S]*map\.flyToBounds\([\s\S]*?duration:\s*0\.8/,
  'Territory map should keep flyToBounds animation for explicit recenter actions.',
);
assert.match(
  territorySource,
  /map\.setView\(\[latitude, longitude\], territoryInitialZoom\(center\), \{ animate:\s*false \}\)/,
  'Territory should use non-animated setView for initial live-center placement.',
);
assert.match(
  territorySource,
  /function territoryInitialZoom\(center\)[\s\S]*?Math\.min\(Math\.max\(Number\.isFinite\(zoom\) \? zoom : 13, 12\), 14\)/,
  'Territory should use non-animated setView with a bounded game-map zoom so territory and place labels both remain visible.',
);

// ── 2. Marker-free concrete land layer ──────────────────────────────────────
assert.doesNotMatch(
  territorySource,
  /L\.marker\(|L\.divIcon\(|terr-runner-marker|terr-marker/,
  'Territory should not render runner point markers over the concrete territory land layer.',
);

// ── 3. Contested-territory marching ants ────────────────────────────────────
assert.doesNotMatch(
  territorySource,
  /className:\s*cell\.contested\s*\?\s*'terr-contested-polygon'\s*:\s*null/,
  'Territory should not render legacy contested marching-ants polygons over the smoothed land mask.',
);

console.log('[PASS] Territory smooth-camera + marker-free land guardrail passed.');
