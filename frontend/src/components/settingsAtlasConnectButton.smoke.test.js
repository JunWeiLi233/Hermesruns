import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const layoutSource = readFileSync(path.join(here, 'SettingsAtlasLayout.jsx'), 'utf8');
const styleSource = readFileSync(path.join(here, '../styles/_split/settings.css'), 'utf8');

assert.match(
  layoutSource,
  /className=\{`settings-atlas-service-action\$\{stravaConnected \? '' : ' is-connect'\}`\}/,
  'The Strava service action should keep the scoped is-connect variant hook so the compact button styling stays isolated.',
);

const compactConnectButtonRule = styleSource.match(/\.settings-atlas-service-action\.is-connect\s*\{([^}]*)\}/s);

assert.ok(
  compactConnectButtonRule,
  'The settings connect button should define its own compact variant rule.',
);

const compactConnectButtonBody = compactConnectButtonRule[1];

assert.match(compactConnectButtonBody, /display:\s*inline-flex;/, 'The connect button should render as an inline-flex control.');
assert.match(compactConnectButtonBody, /width:\s*auto;/, 'The connect button should size to its label instead of stretching full-width.');
assert.match(compactConnectButtonBody, /align-self:\s*flex-start;/, 'The connect button should pin to the start edge instead of stretching within the card.');
assert.match(compactConnectButtonBody, /min-height:\s*38px;/, 'The connect button should use a smaller standard button height.');
assert.match(compactConnectButtonBody, /padding:\s*0 14px;/, 'The connect button should tighten its horizontal padding.');
assert.match(compactConnectButtonBody, /font-size:\s*0\.74rem;/, 'The connect button should use a more typical button text size.');

assert.match(
  styleSource,
  /\.settings-atlas-service-card--garmin\s+\.settings-atlas-service-action\.is-connect\s*\{[^}]*width:\s*auto;[^}]*flex:\s*0 0 auto;[^}]*align-self:\s*flex-start;/s,
  'The Garmin connect button should also escape the wide CTA sizing.',
);

assert.match(
  styleSource,
  /@media\s*\([^)]+\)\s*\{[\s\S]*?\.settings-atlas-service-card--garmin\s+\.settings-atlas-service-action\.is-connect\s*\{[^}]*width:\s*auto;[^}]*align-self:\s*flex-start;/s,
  'Responsive settings rules should keep the Garmin connect button compact instead of forcing it back to full width.',
);

assert.match(
  styleSource,
  /\.settings-atlas-canvas\s+\.st-service-head\s+\.settings-atlas-service-action\s*\{[^}]*width:\s*auto;[^}]*flex:\s*0 0 auto;[^}]*align-self:\s*center;[^}]*white-space:\s*nowrap;/s,
  'Every Strava action state must remain compact so it cannot consume the provider-copy column in the two-card service grid.',
);

assert.match(
  styleSource,
  /\.st-service-head\s*\{[^}]*align-items:\s*flex-start;/s,
  'Provider icons and actions should share the same top alignment even when one summary wraps onto multiple lines.',
);

assert.match(
  styleSource,
  /\.settings-atlas-canvas\s+\.st-service-info\s*>\s*span\s*\{[^}]*overflow-wrap:\s*anywhere;[^}]*line-height:\s*1\.45;/s,
  'Provider summaries should wrap across their available grid column instead of stacking one character per line.',
);

assert.match(
  styleSource,
  /\.settings-atlas-canvas\s+\.st-services-grid\s*\{[^}]*width:\s*min\(100%, 960px\);[^}]*grid-template-columns:\s*repeat\(2, minmax\(0, 1fr\)\);[^}]*margin:\s*0 auto 20px;/s,
  'The connected-service cards should use a bounded, centered two-column grid on desktop.',
);

console.log('[PASS] Settings atlas connect button compact sizing guard passed.');
