import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const srcRoot = path.resolve(here, '..');

function read(relativePath) {
  return readFileSync(path.join(srcRoot, relativePath), 'utf8');
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

const landingSource = read('pages/Landing.jsx');
const styleSource = read('styles/style.css');

assert(
  landingSource.includes('landing-command-hero')
    && landingSource.includes('landing-command-copy')
    && landingSource.includes('landing-command-board landing-cinematic-hero-proof'),
  'Landing hero should use the command editorial composition.',
);

assert(
  landingSource.includes('landing-command-deck')
    && landingSource.includes('landing-command-card-stack')
    && landingSource.includes('landing-command-rhythm')
    && !landingSource.includes('landing-cinematic-feature-grid'),
  'Landing should use the command deck instead of the old equal feature grid.',
);

assert(
  styleSource.includes('Landing command editorial redesign')
    && /\.landing-command-hero\s*\{[\s\S]*grid-template-columns:\s*minmax\(0,\s*0\.92fr\)\s+minmax\(520px,\s*1\.08fr\);/.test(styleSource)
    && /\.landing-command-deck-grid\s*\{[\s\S]*grid-template-columns:\s*minmax\(320px,\s*0\.9fr\)\s+minmax\(0,\s*1\.1fr\);/.test(styleSource),
  'Landing command CSS should define the asymmetric hero and command deck grids.',
);

assert(
  /\.landing-command-hero\s+\.landing-cinematic-hero-title\s*>\s*span\s*\{[\s\S]*text-wrap:\s*nowrap;/.test(styleSource),
  'Landing hero title spans should keep manual line breaks instead of inheriting balanced wrapping.',
);

assert(
  /\.landing-command-hero\s+\.landing-cinematic-hero-title\s*>\s*span:not\(\.is-accent\)\s*\{[\s\S]*color:\s*rgba\(255,\s*250,\s*243,\s*0\.82\);/.test(styleSource),
  'Landing hero non-accent title lines should stay legible on the dark first screen.',
);

assert(
  landingSource.includes("navigate(isAdmin ? '/dashboard' : '/profile')")
    && landingSource.includes('/api/auth/strava/start?state=login')
    && landingSource.includes('to="/login"')
    && landingSource.includes('to="/signup"'),
  'Landing redesign must preserve auth redirect, Strava start, and login/signup routes.',
);

assert(
  landingSource.includes('const heroWorkout =')
    && landingSource.includes("t('landing.cinematic_hud_workout_title', heroWorkout)")
    && landingSource.includes("t('landing.cinematic_hud_workout_copy', heroWorkout)")
    && landingSource.includes("t('landing.cinematic_hud_shoe', heroWorkout)"),
  'Landing command board should provide replacements for i18n placeholders.',
);

assert(
  landingSource.includes('const formulaValues =')
    && landingSource.includes("t('landing.cinematic_formula_vdot', formulaValues)")
    && landingSource.includes("t('landing.cinematic_formula_acwr', formulaValues)")
    && landingSource.includes("t('landing.cinematic_formula_recovery', formulaValues)")
    && landingSource.includes("t('landing.cinematic_formula_paces', formulaValues)")
    && landingSource.includes("t('landing.cinematic_formula_last_input_value', formulaValues)"),
  'Landing formula copy should provide replacements for every public placeholder token.',
);

console.log('[PASS] Landing command editorial guardrails passed.');
