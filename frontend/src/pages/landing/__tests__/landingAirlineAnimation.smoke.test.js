import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const page = readFileSync(path.join(here, '../LandingRaceMap.jsx'), 'utf8');
const scene = readFileSync(path.join(here, '../landingRaceGlobeScene.js'), 'utf8');
const css = readFileSync(path.join(here, '../../../styles/_split/landing.css'), 'utf8');

// One tour clock drives the airliner, the globe camera and the named destination.
assert.match(scene, /const frame = getTourFrame\(races\.length, scene\.tourElapsed\)/);
assert.match(scene, /flightPose\(source\.geo, target\.geo, eased\)/);
assert.match(scene, /if \(tour\.activeId !== state\.selectedId\) onActiveRace\?\.\(tour\.activeId\)/);
assert.match(page, /onActiveRace: setSelectedId/);
assert.match(page, /data-race-id=\{selected\.id\}/);
assert.match(scene, /aircraft\.dataset\.destination = plane\.destination/);
assert.match(scene, /aircraft\.dataset\.flightPhase = plane\.phase/);
assert.match(scene, /rotate\(\$\{scene\.planeAngle\.toFixed\(2\)\}\)/,
  'The airliner must turn along the arc\'s screen heading.');
assert.match(page, /transform="translate\(-24 0\)"/,
  'The pointer nose, rather than its center, must land on the map pin.');
assert.match(page, /d="M 24 0 C[\s\S]*className="landing-cinematic-map-aircraft-cockpit"/,
  'The airliner silhouette must start at the anchored nose and retain its cockpit detail.');
assert.doesNotMatch(page + scene, /<animateMotion|getRaceTimelineDelay/,
  'Do not reintroduce a separate paced path or independently delayed destination clock.');
assert.match(css, /\.is-flight-synced \.landing-cinematic-map-caption \{[^}]*display: none;[^}]*animation: none;/);
assert.match(css, /\.is-flight-synced \.landing-cinematic-map-caption\.is-active \{ display: grid; \}/);
assert.match(css, /\.is-flight-synced \.landing-cinematic-map-flight-route-live \{[^}]*animation: none;/);
assert.match(css, /\.landing-cinematic-map-aircraft-cockpit\s*\{[\s\S]*fill:\s*#fffaf3;/);
assert.match(scene, /cancelAnimationFrame\(frameId\)/);
assert.match(page, /document\.addEventListener\('visibilitychange', updateVisibility\)/);
assert.match(page, /active: onScreen && documentVisible/);
assert.match(scene, /const t = motion\(\) \? Math\.min\(1, flight\.elapsed \/ flight\.duration\) : 1;/,
  'Reduced motion must jump straight to the destination instead of animating the flight.');
// The effective reduced-motion guards: a selection lands at once, and the tour never animates a leg.
assert.match(scene, /if \(!motion\(\) \|\| angularDistance\(from, race\.geo\) < 1e-4\)/,
  'Under reduced motion flyTo must place the airliner at the destination without starting a flight.');
assert.match(scene, /if \(frame\.travelling && motion\(\)\)/,
  'Under reduced motion the tour must dwell at each race instead of flying between them.');
assert.match(css, /@media \(prefers-reduced-motion:\s*reduce\)[\s\S]*\.landing-cinematic-map-aircraft \{\s*display: none;/);
console.log('[PASS] Landing race pointer synchronization guardrails passed.');
