import assert from 'node:assert/strict';
import { existsSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const landingSource = readFileSync(path.join(here, 'Landing.jsx'), 'utf8');
const styleSource = readFileSync(path.join(here, '../styles/style.css'), 'utf8');
const revealHookSource = readFileSync(path.join(here, '../hooks/useScrollReveal.js'), 'utf8');
const heroAssetPath = path.join(here, '../assets/generated/landing-command-hero-background.png');

assert.match(
  landingSource,
  /className="landing-cinematic-hero-grid landing-command-hero"/,
  'Landing hero grid should carry the command hero class targeted by the background image.',
);

assert.ok(
  existsSync(heroAssetPath),
  'Generated landing command hero background asset should exist in the repo asset pipeline.',
);

assert.ok(
  statSync(heroAssetPath).size > 250000,
  'Landing command hero background should be a real generated raster asset, not an empty placeholder.',
);

assert.match(
  styleSource,
  /\.landing-cinematic-hero-grid\.landing-command-hero\s*\{[\s\S]*url\("\.\.\/assets\/generated\/landing-command-hero-background\.png"\)/,
  'Landing command hero grid should use the generated hero image as its background.',
);

assert.match(
  styleSource,
  /\.landing-cinematic-hero-grid\.landing-command-hero \.landing-cinematic-hero-title\s*\{[\s\S]*#fff7ea !important/,
  'Landing command hero title should stay light over the generated background.',
);

assert.match(
  styleSource,
  /\.hermes-site-frame\[data-gpt-taste-system="gpt-taste"\]\.is-public \.landing-cinematic-hero-grid\.landing-command-hero\s*\{[\s\S]*grid-template-columns:\s*minmax\(0,\s*1fr\)\s*!important/,
  'Landing command hero should collapse to a single hero column after removing the proof board.',
);

assert.doesNotMatch(
  landingSource,
  /landing-command-board landing-cinematic-hero-proof/,
  'Landing hero should not render the removed command-board proof panel.',
);

assert.doesNotMatch(
  landingSource,
  /landing-cinematic-hud/,
  'Landing hero should not render the older HUD proof panel either.',
);

assert.doesNotMatch(
  styleSource,
  /landing-runner-hero\.png/,
  'Landing hero CSS should not reference the old missing runner hero asset.',
);

assert.match(
  revealHookSource,
  /typeof IntersectionObserver === 'undefined'[\s\S]*setIsVisible\(true\)/,
  'Landing reveal sections should become visible in browser runtimes without IntersectionObserver.',
);

console.log('[PASS] Landing command hero background guardrails passed.');
