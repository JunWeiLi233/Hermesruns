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
  /import HermesMarkSvg from '\.\.\/components\/HermesMarkSvg';/,
  'Landing should use the shared Hermes mark component for the brand glyph.',
);

assert.match(
  landingSource,
  /name === 'logo'[\s\S]*<HermesMarkSvg tone="light" className=\{`\$\{classNames\} landing-cinematic-glyph--logo`\} \/>/,
  'LandingGlyph should support rendering the Hermes logo mark with the landing-cinematic-glyph class and logo-safe modifier.',
);

assert.match(
  landingSource,
  /landing-cinematic-brand-glyph" aria-hidden="true"[\s\S]{0,180}<LandingGlyph name="logo" \/>/,
  'Landing brand glyph should render the Hermes logo mark.',
);

assert.doesNotMatch(
  landingSource,
  /landing-cinematic-brand-glyph" aria-hidden="true"[\s\S]{0,180}<LandingGlyph name="runner" \/>/,
  'Landing brand glyph should not fall back to the old runner icon.',
);

assert.match(
  landingSource,
  /function StravaLogo\([\s\S]*<rect width="168" height="48" rx="10" fill="#fc4c02" \/>[\s\S]*STRAVA/,
  'Landing should render the Strava logo badge from the provided orange/white brand reference.',
);

assert.equal(
  [...landingSource.matchAll(/landing-cinematic-btn landing-cinematic-btn--primary landing-cinematic-btn--strava is-large/g)].length,
  2,
  'Both large Strava CTA buttons should carry the Strava logo button class.',
);

assert.equal(
  [...landingSource.matchAll(/<StravaLogo \/>/g)].length,
  2,
  'Both large Strava CTA buttons should render the Strava logo.',
);

assert.doesNotMatch(
  landingSource,
  /landing-cinematic-btn landing-cinematic-btn--primary landing-cinematic-btn--strava is-large[\s\S]{0,220}<LandingGlyph name="runner" \/>/,
  'Strava CTA buttons should not keep the old runner glyph.',
);

assert.match(
  landingSource,
  /className="landing-cinematic-hero-grid landing-command-hero"/,
  'Landing hero grid should carry the command hero class targeted by the background image.',
);

assert.match(
  landingSource,
  /className="landing-command-deck"/,
  'Landing feature section should keep the newer command-deck design instead of the old feature-grid fallback.',
);

assert.doesNotMatch(
  landingSource,
  /className="landing-cinematic-features"/,
  'Landing source should not reintroduce the older cinematic feature-grid section.',
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
  /\.landing-cinematic-glyph--logo\s*\{[\s\S]*stroke:\s*none/,
  'Landing Hermes logo should disable the generic red stroked glyph treatment.',
);

assert.match(
  styleSource,
  /\.landing-cinematic-glyph--logo \*\s*\{[\s\S]*stroke:\s*none/,
  'Landing Hermes logo child paths/rects should not inherit the generic red glyph stroke.',
);

assert.match(
  styleSource,
  /\.landing-strava-logo\s*\{[\s\S]*width:\s*78px/,
  'Landing Strava logo should have a stable CTA-sized badge style.',
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
