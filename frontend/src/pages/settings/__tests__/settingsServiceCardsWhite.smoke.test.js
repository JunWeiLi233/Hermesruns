import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const whiteGridStyleSource = readFileSync(path.join(here, "../../../styles/grid-cards-white.css"), 'utf8');
const indexStyleSource = readFileSync(path.join(here, "../../../index.css"), 'utf8');
const settingsStyleSource = readFileSync(path.join(here, "../../../styles/_split/settings.css"), 'utf8');

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

const serviceLayoutStart = settingsStyleSource.indexOf('.st-service-head {');
const phoneServiceLayoutStart = settingsStyleSource.indexOf('@media (max-width: 640px)', serviceLayoutStart);
const phoneServiceLayoutSource = settingsStyleSource.slice(phoneServiceLayoutStart);

assert.match(
  phoneServiceLayoutSource,
  /\.settings-atlas-canvas \.st-service-head\s*\{[^}]*display:\s*grid;[^}]*grid-template-columns:\s*40px minmax\(0, 1fr\);/,
  'Phone service headers should reserve a stable icon column and a shrinkable copy column.',
);

assert.match(
  phoneServiceLayoutSource,
  /\.settings-atlas-canvas \.st-service-head :is\(\.settings-atlas-service-action, \.st-service-btn\)\s*\{[^}]*grid-column:\s*1 \/ -1;[^}]*width:\s*100%;[^}]*min-width:\s*0;[^}]*min-height:\s*44px;[^}]*white-space:\s*normal;[^}]*overflow-wrap:\s*anywhere;/,
  'Phone Strava and Garmin actions should stack below service copy and wrap within a 44px touch target.',
);

assert.match(
  phoneServiceLayoutSource,
  /\.settings-atlas-canvas \.st-service-info :is\(strong, span\)\s*\{[^}]*max-width:\s*100%;[^}]*white-space:\s*normal;[^}]*overflow-wrap:\s*anywhere;/,
  'Phone provider names and status copy should wrap instead of widening the service card.',
);

console.log('[PASS] Settings connected-services grid white-surface guard passed.');
