import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const appSource = readFileSync(path.join(here, '../styles/app.css'), 'utf8');
const liquidGlassSource = readFileSync(path.join(here, '../styles/all-pages-liquid-glass.css'), 'utf8');
const finalWhiteSource = readFileSync(path.join(here, '../styles/grid-cards-white.css'), 'utf8');

const cardSweepIndex = liquidGlassSource.lastIndexOf('.runner-dashboard-page :is(');
const headingResetIndex = finalWhiteSource.lastIndexOf(
  'body:is(.theme-light, .theme-high-contrast-light) #root .runner-dashboard-page[data-muscle-theme="white"]:has(.mt-top-workbench) .mt-top-muscle-card .mt-top-panel-head,',
);

assert.ok(
  appSource.indexOf("@import './grid-cards-white.css';") > appSource.indexOf("@import './all-pages-liquid-glass.css';"),
  'The final white-theme guard must load after the shared liquid-glass card sweep.',
);
assert.ok(
  cardSweepIndex >= 0 && headingResetIndex >= 0,
  'The muscle-selection heading must have a final nested reset after the shared card sweep.',
);
assert.match(
  finalWhiteSource.slice(headingResetIndex, headingResetIndex + 520),
  /border:\s*0 !important;[\s\S]*border-radius:\s*0 !important;[\s\S]*background:\s*transparent !important;[\s\S]*background-image:\s*none !important;[\s\S]*box-shadow:\s*none !important;/,
  'The light-theme muscle-selection heading should not paint a strip on top of its card.',
);
assert.doesNotMatch(
  finalWhiteSource,
  /body:is\(\.theme-light, \.theme-high-contrast-light\) #root \.runner-dashboard-page\[data-muscle-theme="white"\]:has\(\.mt-top-workbench\) \.mt-top-muscle-card\s*\{[\s\S]*background:\s*transparent !important;/,
  'The muscle-selection card background must remain intact while its heading strip is removed.',
);

console.log('[PASS] Muscle Training top-panel strip guardrails passed.');
