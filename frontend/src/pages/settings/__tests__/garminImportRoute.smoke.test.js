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
const settingsStyles = readFileSync(path.join(here, "../../../styles/settings-fullwidth.css"), 'utf8').replace(/\r\n/g, '\n');

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
  'The Garmin modal should retain the form heading and credential note shown in the reference.',
);

const referenceStylesStart = settingsStyles.indexOf('/* Garmin modal Apple reference surface */');
assert.ok(referenceStylesStart >= 0, 'The Garmin modal should define the approved Apple reference surface.');
const referenceStyles = settingsStyles.slice(referenceStylesStart);

assert.match(
  referenceStyles,
  /\.settings-garmin-import-modal-shell\s*\{[\s\S]*?background: #f7f7f8;[\s\S]*?backdrop-filter: blur\(8px\);/,
  'The Garmin modal should use the neutral reference backdrop.',
);
assert.match(
  referenceStyles,
  /#root \.settings-garmin-import-modal-card\s*\{[\s\S]*?width: min\(1010px, 72\.2vw\);[\s\S]*?max-width: 1010px;[\s\S]*?height: min\(1008px, 75vw, 90\.5vh\);[\s\S]*?border-radius: 28px;[\s\S]*?background: #ffffff !important;/,
  'The Garmin modal should use the wider opaque white sheet from the reference.',
);
assert.match(
  referenceStyles,
  /#root \.settings-garmin-import-modal-card \.modal-header h3\s*\{[\s\S]*?font-size: clamp\(1\.9rem, 3\.2vw, 2\.8rem\);/,
  'The Garmin modal should use a clear, prominent shared title.',
);
assert.match(
  referenceStyles,
  /#root \.settings-garmin-import-modal-card \.modal-header h3\s*\{[\s\S]*?font-style: normal;[\s\S]*?transform: none;/,
  'The Garmin modal title should remain upright and unskewed.',
);
assert.match(
  referenceStyles,
  /#root \.settings-garmin-import-modal-card \.modal-header\s*\{[\s\S]*?padding: clamp\(20px, 2\.6vw, 38px\) clamp\(32px, 4\.4vw, 62px\) 0;/,
  'The Garmin modal title should sit closer to the top edge like the reference.',
);
assert.match(
  referenceStyles,
  /#root \.settings-garmin-import-modal-card \.modal-close\s*\{[\s\S]*?width: clamp\(36px, 3\.6vw, 50px\);[\s\S]*?height: clamp\(36px, 3\.6vw, 50px\);/,
  'The Garmin modal should keep a comfortable reference-sized close target.',
);
assert.match(
  referenceStyles,
  /#root \.settings-garmin-import-modal-content :is\(\.garmin-profile-form-card, \.garmin-profile-wellness-card\)\s*\{[\s\S]*?background: #ffffff !important;[\s\S]*?box-shadow: none !important;/,
  'The Garmin modal sections should use flat, restrained surfaces.',
);
assert.match(
  referenceStyles,
  /#root \.settings-garmin-import-modal-content :is\(\.garmin-profile-card-head, \.garmin-profile-card-title\)\s*\{[\s\S]*?background: transparent !important;[\s\S]*?background-image: none !important;[\s\S]*?box-shadow: none !important;/,
  'The Garmin modal form heading should not render a panel strip behind its text.',
);
assert.match(
  referenceStyles,
  /#root \.settings-garmin-import-modal-content \.garmin-profile-main-grid\s*\{[\s\S]*?grid-template-columns: minmax\(0, 1fr\) !important;/,
  'The Garmin modal should stack the form and wellness sections vertically.',
);
assert.match(
  referenceStyles,
  /#root \.settings-garmin-import-modal-content \.garmin-import-actions :is\(\.btn-secondary, \.btn-primary\)\s*\{[\s\S]*?min-height: clamp\(44px, 3\.85vw, 54px\);[\s\S]*?border-radius: 12px;/,
  'The Garmin modal actions should remain large and clearly labeled.',
);
assert.match(
  referenceStyles,
  /#root \.settings-garmin-import-modal-content \.garmin-import-actions\s*\{[\s\S]*?max-width: clamp\(300px, 30\.3vw, 424px\);[\s\S]*?margin-left: auto;/,
  'The Garmin import actions should form a compact trailing group on desktop.',
);
assert.match(
  referenceStyles,
  /#root \.settings-garmin-import-modal-content \.garmin-import-actions\s*\{[\s\S]*?display: grid !important;[\s\S]*?grid-template-columns: minmax\(0, 0\.88fr\) minmax\(0, 1fr\) !important;/,
  'The Garmin import actions should use the compact two-column proportions from the reference.',
);
assert.match(
  referenceStyles,
  /#root \.settings-garmin-import-modal-content \.garmin-import-actions :is\(\.btn-secondary, \.btn-primary\)\s*\{[\s\S]*?width: 100% !important;[\s\S]*?clip-path: none !important;[\s\S]*?font-style: normal !important;[\s\S]*?white-space: nowrap;/,
  'The Garmin import actions should be rectangular, upright, equal-height, and single-line.',
);
assert.doesNotMatch(referenceStyles, /(?:linear|radial)-gradient\(/, 'The Garmin modal reference surface should not use gradients.');

const fullDividerStart = settingsStyles.indexOf('/* Garmin modal full-length action divider */');
assert.ok(fullDividerStart >= 0, 'The Garmin modal should define a full-length action divider.');
const fullDividerStyles = settingsStyles.slice(fullDividerStart);
assert.match(
  fullDividerStyles,
  /#root \.settings-garmin-import-modal-content \.garmin-import-actions\s*\{[\s\S]*?width: 100%;[\s\S]*?max-width: none;[\s\S]*?border-top: 0;/,
  'The Garmin action row should span the full content width without using the compact group border.',
);
assert.match(
  fullDividerStyles,
  /#root \.settings-garmin-import-modal-content \.garmin-import-actions::before\s*\{[\s\S]*?left: 0;[\s\S]*?right: 0;/,
  'The Garmin action divider should run from the left edge to the right edge.',
);
assert.match(
  fullDividerStyles,
  /#root \.settings-garmin-import-modal-content \.garmin-import-actions\s*\{[\s\S]*?grid-template-columns: minmax\(140px, 170px\) minmax\(160px, 220px\) !important;[\s\S]*?justify-content: end;/,
  'The Garmin action buttons should remain compact and trailing under the full-width divider.',
);

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
  /fit_export_source_title[\s\S]*coros_source_title[\s\S]*huawei_source_title[\s\S]*ImportDataGuide/,
  'Manual import should remain on its dedicated /settings/import-data surface.',
);

console.log('[PASS] Garmin in-place modal and removed-route guardrails passed.');
