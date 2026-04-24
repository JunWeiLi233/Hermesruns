/**
 * Smoke test: race localization stays shared and trustworthy.
 *
 * Verifies that:
 * 1. Races.jsx imports the shared race-localization utility.
 * 2. Shared helpers return stable Chinese labels for race targets, places, and catalog names.
 * 3. Shared helpers preserve English labels when English is active.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import {
  getLocalizedCountryLabel,
  getLocalizedRaceLabel,
  getLocalizedRaceLocation,
  getSafeRaceTargetLabel,
} from './raceLocalization.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const racesSource = readFileSync(path.join(here, '..', 'pages', 'Races.jsx'), 'utf8');

assert.match(
  racesSource,
  /from ['"]\.\.\/utils\/raceLocalization['"]/,
  'Races.jsx should import the shared raceLocalization utility.'
);
assert.doesNotMatch(
  racesSource,
  /function getLocalizedRaceLabel|function getLocalizedRaceLocation|function getLocalizedCountryLabel/,
  'Races.jsx should rely on shared race localization helpers instead of redefining them locally.'
);

assert.equal(getSafeRaceTargetLabel('half', 'zh-CN'), '半程马拉松');
assert.equal(getSafeRaceTargetLabel('marathon', 'en'), 'Marathon');

assert.equal(getLocalizedCountryLabel('Japan', 'zh-CN'), '日本');
assert.equal(getLocalizedCountryLabel('Japan', 'en'), 'Japan');

assert.equal(
  getLocalizedRaceLabel({ id: 'tokyo-marathon', name: 'Tokyo Marathon' }, 'zh-CN'),
  '东京马拉松'
);
assert.equal(
  getLocalizedRaceLabel({ id: 'tokyo-marathon', name: 'Tokyo Marathon' }, 'en'),
  'Tokyo Marathon'
);

assert.equal(
  getLocalizedRaceLocation(
    {
      id: 'tokyo-marathon',
      location: 'Tokyo, Japan',
      city: 'Tokyo',
      country: 'Japan',
    },
    'zh-CN'
  ),
  '东京 · 日本'
);

assert.equal(
  getLocalizedRaceLocation(
    {
      id: 'tokyo-marathon',
      location: 'Tokyo, Japan',
      city: 'Tokyo',
      country: 'Japan',
    },
    'en'
  ),
  'Tokyo, Japan'
);

console.log('[PASS] Race localization smoke test passed.');
