import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const racesDetailSource = readFileSync(path.join(here, '../pages/RacesDetail.jsx'), 'utf8');
const styleSource = readFileSync(path.join(here, '../styles/style.generated.css'), 'utf8');

assert.match(
  racesDetailSource,
  /const EMPTY_COURSE_MAP = Object\.freeze\(\{/,
  'RacesDetail should still define a dedicated empty course-map state object for the runner-facing route map surface.',
);

assert.doesNotMatch(
  racesDetailSource,
  /className="race-detail-map-street-fallback"/,
  'RacesDetail should not mount a React-managed street-tile snapshot inside the runner-facing map card.',
);

assert.doesNotMatch(
  styleSource,
  /\.race-detail-map-street-fallback\s*\{/,
  'Race detail map styles should not define a static tile fallback layer outside Leaflet.',
);

console.log('[PASS] Race detail map image fallback guardrails passed.');
