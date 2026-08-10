import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const landingSource = readFileSync(path.join(here, 'Landing.jsx'), 'utf8');
const styleSource = readFileSync(path.join(here, '../styles/_split/landing.css'), 'utf8');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

assert(
  /function buildCurvedFlightPath\(points\)[\s\S]*?Q \$\{midpointX\.toFixed\(2\)\} \$\{controlY\.toFixed\(2\)\}/.test(landingSource),
  'Landing race map should build curved flight legs instead of flashing destination markers only.',
);

assert(
  /const flightPath = buildCurvedFlightPath\(\[\.\.\.flightPoints, flightPoints\[0\]\]/.test(landingSource),
  'Landing race map should close the route so the airline can loop back to the first destination.',
);

assert(
  /landing-cinematic-map-flight-route-live[\s\S]*landing-cinematic-map-aircraft[\s\S]*<animateMotion dur=\{raceCycleDuration\} path=\{flightPath\} rotate="auto" repeatCount="indefinite"/.test(landingSource),
  'Landing race map should render one looping aircraft on the route path.',
);

assert(
  !landingSource.includes('landing-cinematic-map-selection-layer'),
  'Landing race map should not retain the old stacked selection-ring animation.',
);

assert(
  /<circle r="0\.72" className="landing-cinematic-map-pin-halo"\s*\/>[\s\S]*<circle r="0\.5" className="landing-cinematic-map-badge"\s*\/>[\s\S]*<circle r="0\.12" className="landing-cinematic-map-core"\s*\/>/.test(landingSource)
    && /<text x="0" y="0\.16"[\s\S]*landing-cinematic-map-order/.test(landingSource)
    && /\.landing-cinematic-map-order\s*\{[\s\S]*font-size:\s*0\.68px;/.test(styleSource),
  'Landing race map markers should stay compact while preserving a readable order label.',
);

assert(
  /\.landing-cinematic-map-flight-route\s*\{[\s\S]*stroke-dasharray:[\s\S]*vector-effect:\s*non-scaling-stroke;/.test(styleSource)
    && /\.landing-cinematic-map-flight-route-live\s*\{[\s\S]*animation:\s*landing-cinematic-map-flight-route-step/.test(styleSource)
    && /\.landing-cinematic-map-aircraft-glow\s*\{[\s\S]*animation:\s*landing-cinematic-map-aircraft-glow-step/.test(styleSource),
  'Landing race map styles should keep the route legible and give the aircraft a restrained glow.',
);

assert(
  /\.landing-cinematic-map-pin-halo\s*\{[\s\S]*stroke:\s*rgba\(240,\s*117,\s*97,\s*0\.46\)[\s\S]*animation:\s*landing-cinematic-map-pin-halo-step/.test(styleSource)
    && /\.landing-cinematic-map-badge\s*\{[\s\S]*stroke:\s*rgba\(255,\s*250,\s*243,\s*0\.98\)/.test(styleSource),
  'Landing race map markers should use a visible coral halo and high-contrast compact badge.',
);

assert(
  /@media \(prefers-reduced-motion:\s*reduce\)[\s\S]*\.landing-cinematic-map-flight-route-live[\s\S]*\.landing-cinematic-map-aircraft[\s\S]*\.landing-cinematic-map-pin-halo[\s\S]*display:\s*none;/.test(styleSource),
  'Landing race map should freeze safely for reduced-motion users.',
);

console.log('[PASS] Landing airline route animation guardrails passed.');
