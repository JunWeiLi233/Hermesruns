import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const settingsSource = readFileSync(path.join(here, "../Settings.jsx"), 'utf8');
const layoutSource = readFileSync(path.join(here, "../../../components/SettingsAtlasLayout.jsx"), 'utf8');
const settingsCssSource = readFileSync(path.join(here, "../../../styles/_split/settings.css"), 'utf8');

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

const wellnessRowRule = settingsCssSource.match(/\.st-wellness-row \{[\s\S]*?\}/)?.[0] ?? '';

assert.match(
  wellnessRowRule,
  /background:\s*#ffffff/,
  'Wellness grid rows should keep a pure-white background in light themes.',
);

assert.ok(
  !wellnessRowRule.includes('rgba(0,0,0,0.02)'),
  'Wellness grid rows should not fall back to the gray tint over the white card.',
);

console.log('[PASS] Settings wellness hub source-preference guard passed.');
