import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const territorySource = readFileSync(path.join(here, 'Territory.jsx'), 'utf8');
const splitTerritoryCss = readFileSync(
  path.join(here, '../styles/_split/territory.css'),
  'utf8',
);
const bundledStyle = readFileSync(path.join(here, '../styles/style.css'), 'utf8');

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
  /map\.setView\(\[latitude, longitude\], territoryInitialZoom\(center\), \{ animate:\s*false \}\)[\s\S]*?function territoryInitialZoom\(center\)[\s\S]*?Math\.max\(Number\.isFinite\(zoom\) \? zoom : 14, 14\)/,
  'Territory should use non-animated setView with a minimum zoom so disconnected territory components do not force a sparse map.',
);

// ── 2. Concrete multi-player markers ────────────────────────────────────────
// Initial-letter chip per runner replaces the abstract colored dot.
assert.match(
  territorySource,
  /terr-runner-marker/,
  'Territory should render a terr-runner-marker chip element for each runner instead of inline colored dots.',
);
assert.match(
  territorySource,
  /terr-runner-marker--active/,
  'Active runner should get the --active modifier so the pulse animation fires only on them.',
);
assert.match(
  territorySource,
  /String\(runner\.name \|\| 'R'\)\.trim\(\)\.slice\(0, 1\)\.toUpperCase\(\)/,
  'Marker should display the first letter of each runner name (concrete identity).',
);
assert.match(
  territorySource,
  /zIndexOffset:\s*runner\.active\s*\?\s*1000\s*:\s*0/,
  'Active runner marker should sit on top when markers from multiple runners cluster.',
);

// ── 3. Contested-territory marching ants ────────────────────────────────────
assert.match(
  territorySource,
  /className:\s*cell\.contested\s*\?\s*'terr-contested-polygon'\s*:\s*null/,
  'Contested polygons should receive the terr-contested-polygon class so the march animation can hook in.',
);

// ── 4. CSS rules + keyframes shipped ────────────────────────────────────────
for (const css of [splitTerritoryCss, bundledStyle]) {
  assert.match(
    css,
    /\.terr-runner-marker\s*\{/,
    'CSS must define .terr-runner-marker chip styles.',
  );
  assert.match(
    css,
    /@keyframes\s+terr-runner-pulse/,
    'CSS must define the terr-runner-pulse keyframe so the active marker breathes.',
  );
  assert.match(
    css,
    /@keyframes\s+terr-contested-march/,
    'CSS must define the terr-contested-march keyframe so contested borders animate.',
  );
  assert.match(
    css,
    /@media \(prefers-reduced-motion: reduce\)/,
    'CSS must respect prefers-reduced-motion for the new animations.',
  );
}

// ── 5. Demo data still wires 5 distinct multi-player runners ────────────────
const leaderboardMatch = territorySource.match(/leaderboard:\s*\[([\s\S]*?)\],\s*territories:/);
assert.ok(leaderboardMatch, 'DEMO_TERRITORY.leaderboard block should exist.');
const colorMatches = [...leaderboardMatch[1].matchAll(/color:\s*'(#[0-9a-fA-F]{6})'/g)].map(
  (m) => m[1].toLowerCase(),
);
assert.ok(
  colorMatches.length >= 5,
  `Demo leaderboard should have at least 5 runners; got ${colorMatches.length}.`,
);
const uniqueColors = new Set(colorMatches);
assert.equal(
  uniqueColors.size,
  colorMatches.length,
  `Every runner should have a unique color so multi-player markers stay distinguishable. Got ${colorMatches.length} runners but only ${uniqueColors.size} unique colors.`,
);

console.log(
  `[PASS] Territory multi-player + smooth-camera + concrete-marker guardrail (${colorMatches.length} runners, ${uniqueColors.size} unique colors).`,
);
