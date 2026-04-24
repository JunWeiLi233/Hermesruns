import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const appSource = readFileSync(path.join(here, '../App.jsx'), 'utf8');
const settingsSource = readFileSync(path.join(here, 'Settings.jsx'), 'utf8');
const layoutSource = readFileSync(path.join(here, '../components/SettingsAtlasLayout.jsx'), 'utf8');
const importDataPageSource = readFileSync(path.join(here, 'ImportDataSettings.jsx'), 'utf8');

assert.match(
  appSource,
  /path="\/settings\/garmin-import"/,
  'App should expose a dedicated /settings/garmin-import route for the Garmin import destination page.',
);

assert.match(
  appSource,
  /path="\/settings\/import-data"/,
  'App should expose a dedicated /settings/import-data route for the manual import destination page.',
);

assert.match(
  appSource,
  /const GarminImportSettings = React\.lazy\(\(\) => import\('\.\/pages\/GarminImportSettings'\)\);/,
  'App should lazy-load the dedicated Garmin import settings page.',
);

assert.match(
  appSource,
  /const ImportDataSettings = React\.lazy\(\(\) => import\('\.\/pages\/ImportDataSettings'\)\);/,
  'App should lazy-load the dedicated manual import settings page.',
);

assert.match(
  layoutSource,
  /navigate\('\/settings\/garmin-import'\)/,
  'Settings should keep the Garmin account button pointed at the Garmin import page.',
);

assert.match(
  layoutSource,
  /settings-atlas-import-drop--garmin[\s\S]*navigate\('\/settings\/import-data'\)/,
  'The manual import card should navigate to /settings/import-data instead of opening an inline modal.',
);

assert.doesNotMatch(
  layoutSource,
  /settings-atlas-import-drop--garmin[\s\S]*setActiveModal\('manual'\)/,
  'The settings atlas manual import card should no longer open the manual modal inline.',
);

assert.doesNotMatch(
  layoutSource,
  /setActiveModal\('garmin'\)/,
  'Settings atlas should no longer open the Garmin import modal once the route-driven page exists.',
);

assert.doesNotMatch(
  settingsSource,
  /activeModal === 'garmin'/,
  'Settings page should stop rendering the Garmin modal once the dedicated route owns that surface.',
);

const garminPageSource = readFileSync(path.join(here, 'GarminImportSettings.jsx'), 'utf8');

assert.match(
  importDataPageSource,
  /fit_export_source_title/,
  'Manual import page should keep a dedicated FIT/GPX source lane.',
);

assert.match(
  importDataPageSource,
  /coros_source_title/,
  'Manual import page should keep a dedicated COROS source lane.',
);

assert.match(
  importDataPageSource,
  /huawei_source_title/,
  'Manual import page should keep a dedicated Huawei source lane.',
);

assert.match(
  importDataPageSource,
  /ImportDataGuide/,
  'Manual import page should keep the reusable import guide on the destination surface.',
);

assert.doesNotMatch(
  garminPageSource,
  /ImportDataGuide/,
  'Garmin import page should no longer render the manual import guide once manual file intake moves to /settings/import-data.',
);

assert.doesNotMatch(
  garminPageSource,
  /watch_import_files|fit_export_source_title|coros_source_title|huawei_source_title/,
  'Garmin import page should stop presenting non-Garmin manual import lanes.',
);

console.log('[PASS] Garmin import route guardrails passed.');
