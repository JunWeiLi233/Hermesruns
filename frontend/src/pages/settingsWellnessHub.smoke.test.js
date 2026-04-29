import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const settingsSource = readFileSync(path.join(here, 'Settings.jsx'), 'utf8');
const layoutSource = readFileSync(path.join(here, '../components/SettingsAtlasLayout.jsx'), 'utf8');

assert.match(
  settingsSource,
  /\/api\/wellness\/source-preferences/,
  'Settings should load the wellness source-preferences contract for the multi-wearable hub.',
);

assert.match(
  layoutSource,
  /settings\.stitch_wellness_hub_title/,
  'Settings atlas layout should render the wellness hub heading.',
);

assert.match(
  layoutSource,
  /wellnessRows\.map[\s\S]*t\(row\.labelKey\)/,
  'Settings atlas layout should expose the per-metric source controls for sleep.',
);

console.log('[PASS] Settings wellness hub source-preference guard passed.');
