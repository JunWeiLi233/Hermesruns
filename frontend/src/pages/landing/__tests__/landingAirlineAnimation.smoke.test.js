import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const page = readFileSync(path.join(here, '../Landing.jsx'), 'utf8');
const css = readFileSync(path.join(here, '../../../styles/_split/landing.css'), 'utf8');

assert.match(page, /buildRaceFlight, getRaceFlightFrame/);
assert.match(page, /getRaceFlightFrame\(flight\.legs, elapsed\)/);
assert.match(page, /onActiveRaceChange\(destination\)/);
assert.match(page, /activeRaceId=\{activeRaceId\}[\s\S]*onActiveRaceChange=\{setActiveRaceId\}/);
assert.match(page, /pointer\.dataset\.destination = destination/);
assert.match(page, /transform="translate\(-2\.55 0\)"/,
  'The pointer nose, rather than its center, must land on the map pin.');
assert.match(page, /<circle r="2\.2" className="landing-cinematic-map-aircraft-glow"\s*\/>\s*<g transform="translate\(-2\.55 0\)">/,
  'The airplane glow should stay centered on the destination while the silhouette is nose-anchored.');
assert.match(page, /M 2\.55 0 L 0\.65 -0\.16 L -0\.28 -1\.3[\s\S]*className="landing-cinematic-map-aircraft-cockpit"/,
  'The moving marker should use a narrow airplane silhouette with swept wings and a cockpit detail.');
assert.doesNotMatch(page, /<animateMotion|getRaceTimelineDelay/,
  'Do not reintroduce a separate paced path or independently delayed destination clock.');
assert.match(css, /\.is-flight-synced \.landing-cinematic-map-caption \{[^}]*display: none;[^}]*animation: none;/);
assert.match(css, /\.is-flight-synced \.landing-cinematic-map-caption\.is-active \{ display: grid; \}/);
assert.match(css, /\.is-flight-synced \.landing-cinematic-map-flight-route-live \{[^}]*animation: none;/);
assert.match(css, /\.landing-cinematic-map-aircraft-cockpit\s*\{[\s\S]*fill:\s*#fffaf3;/);
assert.match(page, /cancelAnimationFrame\(frameId\)/);
assert.match(page, /document\.addEventListener\('visibilitychange', syncPlayback\)/);
assert.match(page, /motionPreference\.matches/);
assert.match(css, /@media \(prefers-reduced-motion:\s*reduce\)[\s\S]*\.landing-cinematic-map-aircraft \{\s*display: none;/);
console.log('[PASS] Landing race pointer synchronization guardrails passed.');
