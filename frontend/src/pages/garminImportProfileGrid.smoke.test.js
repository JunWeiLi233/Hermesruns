import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const pageSource = readFileSync(path.join(here, 'GarminImportSettings.jsx'), 'utf8');
const styleSource = readFileSync(path.join(here, '..', 'styles', '_split', 'integrations.css'), 'utf8');

for (const className of [
  'garmin-profile-page',
  'garmin-profile-hero',
  'garmin-profile-metric-strip',
  'garmin-profile-main-grid',
  'garmin-profile-form-card',
  'garmin-profile-wellness-card',
]) {
  assert.match(pageSource, new RegExp(className), `Garmin import page should expose ${className}.`);
  assert.match(styleSource, new RegExp(`\\.${className}`), `Garmin import styles should own ${className}.`);
}

assert.doesNotMatch(
  pageSource,
  /garmin-import-visual|garmin-import-page-card|garmin-import-page-lower/,
  'The Profile-aligned Garmin page should not keep the duplicated legacy visual and nested page-card hierarchy.',
);

assert.equal(
  (pageSource.match(/\{garminLane\.status\}/g) || []).length,
  1,
  'Garmin readiness should be presented once in the metric strip instead of repeated across the page.',
);

assert.match(
  styleSource,
  /\.garmin-profile-metric-strip\s*\{[\s\S]*?grid-template-columns:\s*repeat\(3,\s*minmax\(0,\s*1fr\)\)/,
  'Garmin summary metrics should use the same three-column cadence as Profile.',
);

assert.match(
  styleSource,
  /\.garmin-profile-main-grid\s*\{[\s\S]*?grid-template-columns:\s*minmax\(0,\s*1\.28fr\)\s+minmax\(320px,\s*0\.72fr\)/,
  'Garmin import should give the primary form more room than the wellness support card.',
);

assert.match(
  styleSource,
  /@media \(max-width:\s*960px\)\s*\{[\s\S]*?\.garmin-profile-main-grid,[\s\S]*?\.garmin-profile-metric-strip\s*\{[\s\S]*?grid-template-columns:\s*minmax\(0,\s*1fr\)/,
  'Garmin grids should collapse before the authenticated top navigation makes the columns cramped.',
);

for (const handlerName of [
  'handleGarminImport',
  'handleGarminSaveCredentials',
  'handleGarminWellnessToggle',
  'handleGarminWellnessSync',
]) {
  assert.match(pageSource, new RegExp(handlerName), `Garmin redesign must preserve ${handlerName}.`);
}

console.log('[PASS] Garmin Profile-grid guardrails passed.');
