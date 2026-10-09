import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const appSource = readFileSync(path.join(here, "../../../App.jsx"), 'utf8');
const preloadSource = readFileSync(path.join(here, "../../../utils/routePreload.js"), 'utf8');
const chromeSource = readFileSync(path.join(here, "../../../components/AuthenticatedPageChrome.jsx"), 'utf8');
const settingsSource = readFileSync(path.join(here, "../Settings.jsx"), 'utf8');
const layoutSource = readFileSync(path.join(here, "../../../components/SettingsAtlasLayout.jsx"), 'utf8');
const garminSource = readFileSync(path.join(here, "../GarminImportSettings.jsx"), 'utf8');
const importDataPageSource = readFileSync(path.join(here, "../ImportDataSettings.jsx"), 'utf8');
const modalStyles = readFileSync(path.join(here, "../../../styles/garmin-import-modal-v2.css"), 'utf8');
const appStyles = readFileSync(path.join(here, "../../../styles/app.css"), 'utf8');

for (const [source, label] of [
  [appSource, 'App'],
  [preloadSource, 'route preloader'],
  [chromeSource, 'authenticated shell'],
  [layoutSource, 'Settings layout'],
]) {
  assert.doesNotMatch(
    source,
    /settings\/garmin-import/,
    `${label} should not retain the removed /settings/garmin-import route.`,
  );
}

assert.match(
  settingsSource,
  /import GarminImportModal from '\.\/GarminImportSettings';/,
  'Settings should own the in-place Garmin import modal entry point.',
);

assert.match(
  settingsSource,
  /const \[garminImportModalOpen, setGarminImportModalOpen\] = useState\(false\);/,
  'Settings should own the Garmin modal open state.',
);

assert.match(
  settingsSource,
  /onOpenGarminImport=\{\(\) => setGarminImportModalOpen\(true\)\}/,
  'Settings should pass an opener callback to the Garmin service card.',
);

assert.match(
  settingsSource,
  /<GarminImportModal\s+embedded=\{garminImportModalOpen\}[\s\S]*?onClose=\{\(\) => setGarminImportModalOpen\(false\)\}/,
  'Settings should render the Garmin import modal in place.',
);

assert.match(
  layoutSource,
  /onOpenGarminImport,/,
  'Settings layout should accept the Garmin modal opener.',
);

assert.match(
  layoutSource,
  /onClick=\{onOpenGarminImport\}/,
  'The Garmin service button should open the modal instead of navigating.',
);

assert.match(
  garminSource,
  /embedded = false, onClose = null/,
  'Garmin import should support embedded modal presentation.',
);

assert.match(
  garminSource,
  /<Modal[\s\S]*?settings-garmin-import-modal-shell[\s\S]*?settings-garmin-import-modal-card/,
  'The embedded Garmin flow should use a dedicated focused modal surface.',
);

assert.match(
  garminSource,
  /!embedded \? \([\s\S]*?garmin-import-page-actions[\s\S]*?\) : null/,
  'The modal should omit the page-only wellness action rail while retaining it for the legacy page presentation.',
);
assert.doesNotMatch(
  garminSource,
  /settings-garmin-import-modal-summary/,
  'The embedded Garmin modal should remove the redundant status summary strip.',
);

assert.match(
  garminSource,
  /<div className="garmin-profile-card-head">[\s\S]*?garminLane\.credentialsNote[\s\S]*?<\/div>/,
  'The full-page presentation should retain its form heading and credential note.',
);

assert.match(garminSource, /portalToBody/, 'The dialog should escape old Settings container rules.');
assert.match(garminSource, /\{garminModalContent\}/, 'The embedded dialog should render its compact form.');
assert.match(garminSource, /garmin-v2-segmented[\s\S]*?aria-pressed/, 'Activity counts should expose their selected state.');
assert.match(garminSource, /role="switch"[\s\S]*?aria-label/, 'Health sync should have an accessible switch.');
assert.doesNotMatch(garminSource, /void handleGarminSaveCredentials/, 'One-time activity imports must not silently save credentials.');
assert.match(appStyles, /@import '\.\/garmin-import-modal-v2\.css';/, 'The compact dialog styles should be active.');
assert.match(modalStyles, /width: min\(500px, calc\(100vw - 32px\)\)/, 'The modal should use the compact responsive reference width.');
assert.match(modalStyles, /max-height: calc\(100dvh - 32px\)/, 'Short screens should constrain the whole dialog.');
assert.match(modalStyles, /overflow: auto/, 'The dialog should scroll when its content exceeds the viewport.');
assert.match(modalStyles, /\.garmin-v2-card \.modal-form[^}]*?overflow: visible/, 'The compact form should not create a second scroll area.');
assert.match(modalStyles, /prefers-reduced-motion: reduce/, 'Import progress should respect reduced motion.');
assert.match(modalStyles, /theme-midnight/, 'The new dialog should support the dark theme.');

for (const handlerName of [
  'handleGarminImport',
  'handleGarminSaveCredentials',
  'handleGarminWellnessToggle',
  'handleGarminWellnessSync',
]) {
  assert.match(garminSource, new RegExp(handlerName), `Garmin modal must preserve ${handlerName}.`);
}

assert.match(
  importDataPageSource,
  /<AuthenticatedPageChrome[\s\S]*<ImportActivityForm[\s\S]*import-page-v2-guide/,
  'Manual import should remain on its dedicated /settings/import-data surface.',
);

console.log('[PASS] Garmin in-place modal and removed-route guardrails passed.');
