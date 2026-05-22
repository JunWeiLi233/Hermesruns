import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const layoutSource = readFileSync(path.join(here, '..', 'components', 'SettingsAtlasLayout.jsx'), 'utf8');
const styleSource = readFileSync(path.join(here, '..', 'styles', 'style.css'), 'utf8');

assert.match(
  layoutSource,
  /settings-atlas-workbench/,
  'Settings should use the redesigned workbench wrapper instead of the old loose three-column layout.',
);

assert.match(
  layoutSource,
  /settings-atlas-column--preferences[\s\S]*settings-atlas-action-rail[\s\S]*settings-atlas-column--ecosystem/,
  'Settings workbench should group preferences, the action rail, and the ecosystem area explicitly.',
);

assert.doesNotMatch(
  layoutSource,
  /settings\.danger_title/,
  'The right rail should not be introduced as a danger zone when it contains safe setup and digest controls.',
);

for (const handlerName of [
  'saveProfile',
  'setUnit',
  'setLang',
  'setTheme',
  'connectStrava',
  'disconnectStrava',
  'toggleDigest',
  'logout',
]) {
  assert.match(layoutSource, new RegExp(handlerName), `Settings redesign must preserve ${handlerName}.`);
}

assert.match(
  styleSource,
  /\.settings-atlas-workbench\s*{[\s\S]*?grid-template-columns:\s*minmax\(0,\s*1fr\)\s+minmax\(310px,\s*360px\)/,
  'Desktop settings workbench should turn empty right space into a bounded rail.',
);

assert.match(
  styleSource,
  /\.settings-control-page \.runner-shell-canvas\.settings-control-canvas,[\s\S]*?\.settings-control-page \.settings-atlas-canvas\s*{[\s\S]*?width:\s*calc\(100% - clamp\(28px,\s*3\.2vw,\s*64px\)\)[\s\S]*?max-width:\s*none !important/,
  'Settings canvas should override the runner-shell max-width and use the available screen width.',
);

assert.match(
  styleSource,
  /@media \(min-width:\s*1540px\)\s*{[\s\S]*?\.settings-control-page \.settings-atlas-workbench\s*{[\s\S]*?grid-template-columns:\s*minmax\(0,\s*1fr\)\s+minmax\(430px,\s*500px\)/,
  'Wide screens should expand the Settings action rail instead of leaving an empty right side.',
);

assert.ok(
  styleSource.lastIndexOf('Settings full-bleed control room pass') > styleSource.lastIndexOf('Runner shell navigation redesign'),
  'The Settings full-bleed override should come after broad runner-shell navigation overrides.',
);

assert.match(
  styleSource,
  /\.settings-atlas-action-rail\s*{[\s\S]*?position:\s*sticky[\s\S]*?top:\s*92px/,
  'The desktop action rail should remain visible without consuming the whole page width.',
);

assert.match(
  styleSource,
  /@media \(max-width:\s*1180px\)\s*{[\s\S]*?\.settings-atlas-workbench\s*{[\s\S]*?grid-template-columns:\s*1fr[\s\S]*?\.settings-atlas-action-rail\s*{[\s\S]*?position:\s*static/,
  'The workbench should collapse cleanly before the right rail becomes cramped.',
);

assert.match(
  styleSource,
  /\.settings-atlas-quick-grid\s*{[\s\S]*?grid-template-columns:\s*1fr/,
  'Quick controls must stay one-column so localized labels remain readable.',
);

console.log('[PASS] Settings workbench layout guardrails passed.');
