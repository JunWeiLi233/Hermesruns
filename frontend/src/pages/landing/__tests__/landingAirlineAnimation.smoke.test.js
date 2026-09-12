import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const page = readFileSync(path.join(here, '../LandingRaceMap.jsx'), 'utf8');
const css = readFileSync(path.join(here, '../../../styles/_split/landing.css'), 'utf8');

assert.match(page, /buildRaceFlight, getRaceFlightFrame/);
assert.match(page, /getRaceFlightFrame\(flight\.legs, elapsedRef\.current\)/);
assert.match(page, /setSelectedId\(destination\.id\)/);
assert.match(page, /data-race-id=\{selected\.id\}/);
assert.match(page, /pointer\.dataset\.destination = destination/);
assert.match(page, /transform="translate\(-24 0\)"/,
  'The pointer nose, rather than its center, must land on the map pin.');
assert.match(page, /d="M 24 0 C[\s\S]*className="landing-cinematic-map-aircraft-cockpit"/,
  'The airliner silhouette must start at the anchored nose and retain its cockpit detail.');
assert.doesNotMatch(page, /<animateMotion|getRaceTimelineDelay/,
  'Do not reintroduce a separate paced path or independently delayed destination clock.');
assert.match(css, /\.is-flight-synced \.landing-cinematic-map-caption \{[^}]*display: none;[^}]*animation: none;/);
assert.match(css, /\.is-flight-synced \.landing-cinematic-map-caption\.is-active \{ display: grid; \}/);
assert.match(css, /\.is-flight-synced \.landing-cinematic-map-flight-route-live \{[^}]*animation: none;/);
assert.match(css, /\.landing-cinematic-map-aircraft-cockpit\s*\{[\s\S]*fill:\s*#fffaf3;/);
assert.match(page, /cancelAnimationFrame\(frameId\)/);
assert.match(page, /document\.addEventListener\('visibilitychange', updateVisibility\)/);
assert.match(page, /reducedMotion \? 1/);
assert.match(css, /@media \(prefers-reduced-motion:\s*reduce\)[\s\S]*\.landing-cinematic-map-aircraft \{\s*display: none;/);
console.log('[PASS] Landing race pointer synchronization guardrails passed.');
