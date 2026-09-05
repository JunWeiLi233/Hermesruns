import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const pageSource = readFileSync(path.join(here, "../Races.jsx"), 'utf8');
const styleSource = readFileSync(path.join(here, "../../../styles/_split/races.css"), 'utf8');

assert.match(
  pageSource,
  /className="race-center-section-head"[\s\S]*?className="race-center-inline-link"[\s\S]*?t\('races\.add_button'\)/,
  'The races calendar should keep the padded add-race action in its section header.',
);

assert.match(
  styleSource,
  /\.race-center-section-head \.race-center-inline-link,[\s\S]*?\.race-center-calendar-head \.race-center-inline-link \{[\s\S]*?padding:\s*8px 12px;/,
  'The races add-race action should have balanced vertical and horizontal padding.',
);

assert.match(
  styleSource,
  /@media \(max-width: 720px\)[\s\S]*?\.race-center-section-head \.race-center-inline-link,[\s\S]*?\.race-center-calendar-head \.race-center-inline-link \{\s*padding:\s*8px 12px;/,
  'The mobile races layout should preserve the add-race action padding.',
);

console.log('[PASS] Races add button padding guard passed.');
