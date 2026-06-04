import assert from 'node:assert/strict';
import { existsSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const landingSource = readFileSync(path.join(here, 'Landing.jsx'), 'utf8');
const styleSource = readFileSync(path.join(here, '../styles/style.css'), 'utf8');
const splitLandingStyle = readFileSync(path.join(here, '../styles/_split/landing.css'), 'utf8');
const revealHookSource = readFileSync(path.join(here, '../hooks/useScrollReveal.js'), 'utf8');
const heroLegacyPngPath = path.join(here, '../assets/generated/landing-command-hero-background.png');
const heroWebpPath = path.join(here, '../assets/generated/landing-command-hero-background.webp');

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
  existsSync(heroWebpPath),
  'WebP variant of landing command hero background should exist as the primary hero asset.',
);

assert.ok(
  statSync(heroWebpPath).size < 200000,
  'WebP variant should be under 200KB — keeps the hero payload tiny on first paint.',
);

// The original 1.97 MB PNG was retired because the image-set() fallback path
// was never hit by any modern browser (every browser that supports image-set
// also supports WebP). Re-introducing it would re-add ~1.9 MB to the bundle.
assert.ok(
  !existsSync(heroLegacyPngPath),
  'Legacy 1.97 MB landing-command-hero-background.png should stay removed — image-set() now ships WebP-only.',
);

assert.match(
  styleSource,
  /\.landing-cinematic-hero-grid\.landing-command-hero\s*\{[\s\S]*image-set\([\s\S]*landing-command-hero-background\.webp[\s\S]*type\("image\/webp"\)[\s\S]*\)/,
  'Landing command hero grid should keep the WebP-only image-set() declaration.',
);

assert.doesNotMatch(
  styleSource,
  /landing-command-hero-background\.png/,
  'Bundled style.css should not reference the retired PNG fallback.',
);

assert.doesNotMatch(
  splitLandingStyle,
  /landing-command-hero-background\.png/,
  'Split landing.css should not reference the retired PNG fallback.',
);

assert.match(
  styleSource,
  /\.landing-cinematic-hero-grid\.landing-command-hero \.landing-cinematic-hero-title\s*\{[\s\S]*#fff7ea !important/,
  'Landing command hero title should stay light over the generated background.',
);

// Removed two `.landing-cinematic-glyph--logo` stroke assertions — the CSS rules
// they pinned were retired with legacy-frame.css in commit 0c921aef. The Hermes
// brand mark now ships via HermesMarkSvg with inline color, not a global override.

// Removed `.landing-strava-logo` width assertion — the rule was retired with
// legacy-frame.css in commit 0c921aef. The Strava CTA logo now scales via
// the in-component SVG viewBox.

assert.match(
  styleSource,
  /\.landing-command-hero\s*\{[\s\S]*grid-template-columns:\s*minmax\(0,\s*0\.92fr\)\s+minmax\(520px,\s*1\.08fr\);/,
  'Landing command hero should keep the restored two-column command board composition.',
);

assert.match(
  landingSource,
  /landing-command-board landing-cinematic-hero-proof/,
  'Landing hero should render the command-board proof panel.',
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
