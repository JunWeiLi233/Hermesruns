import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const whiteGridStyleSource = readFileSync(path.join(here, '../styles/grid-cards-white.css'), 'utf8');
const indexStyleSource = readFileSync(path.join(here, '../index.css'), 'utf8');
const settingsStyleSource = readFileSync(path.join(here, '../styles/_split/settings.css'), 'utf8');

assert.match(
  whiteGridStyleSource,
  /body\.theme-light #root \.settings-control-page \.st-service-card\s*\{[^}]*background:\s*#ffffff !important;[^}]*background-image:\s*none !important;[^}]*backdrop-filter:\s*none !important;/s,
  'The Strava and Garmin service cards must stay on the plain white surface, not the liquid-glass sweep.',
);

assert.doesNotMatch(
  whiteGridStyleSource,
  /theme-midnight[^{]*\.st-service-card/,
  'The white service-card guard must stay light-theme-only so midnight and high-contrast keep their own card surfaces.',
);

assert.match(
  indexStyleSource,
  /@import '\.\/styles\/grid-cards-white\.css';/,
  'grid-cards-white.css must stay imported last so the white guards win the final cascade over the liquid-glass layers.',
);

assert.match(
  settingsStyleSource,
  /\.settings-atlas-service-action\s*\{[^}]*display:\s*inline-flex;[^}]*align-items:\s*center;[^}]*justify-content:\s*center;/s,
  'The connected-service action must center its label even when it is not in the connect state.',
);

console.log('[PASS] Settings connected-services grid white-surface guard passed.');
