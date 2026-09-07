import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const styleSource = readFileSync(path.join(here, '../../../styles/_split/races.css'), 'utf8');

assert.match(
  styleSource,
  /\.races-dashboard-page \.runner-shell-canvas,[\s\S]*?\.races-dashboard-page \.race-center-discovery-grid\s*\{[\s\S]*?min-width:\s*0;[\s\S]*?max-width:\s*100%;[\s\S]*?box-sizing:\s*border-box;/,
  'Races layout containers should be allowed to shrink inside the mobile viewport.',
);

assert.match(
  styleSource,
  /\.races-dashboard-page \.race-center-discovery-toolbar input,[\s\S]*?\.races-dashboard-page \.race-center-filter-chip\s*\{[\s\S]*?box-sizing:\s*border-box;[\s\S]*?max-width:\s*100%;/,
  'Races inputs, actions, and filter chips should include padding inside their viewport-safe width.',
);

assert.match(
  styleSource,
  /@media \(max-width:\s*720px\)[\s\S]*?\.races-dashboard-page \.race-center-discovery-grid\s*\{[\s\S]*?grid-template-columns:\s*minmax\(0,\s*1fr\);/,
  'The mobile race catalog should use a shrinkable single-column grid.',
);

assert.match(
  styleSource,
  /@media \(max-width:\s*720px\)[\s\S]*?\.races-dashboard-page :is\(\s*\.race-center-country-chip,[\s\S]*?\.race-center-filter-chip\s*\)\s*\{[\s\S]*?white-space:\s*normal;[\s\S]*?overflow-wrap:\s*anywhere;/,
  'Long mobile race-filter labels should wrap instead of widening the page.',
);

console.log('[PASS] Races mobile containment guard passed.');
