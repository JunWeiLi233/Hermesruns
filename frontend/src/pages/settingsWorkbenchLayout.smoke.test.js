import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const layoutSource = readFileSync(path.join(here, '..', 'components', 'SettingsAtlasLayout.jsx'), 'utf8');
const styleSource = [
  readFileSync(path.join(here, '..', 'styles', 'style.css'), 'utf8'),
  readFileSync(path.join(here, '..', 'styles', '_split', 'settings.css'), 'utf8'),
].join('\n');

assert.match(
  layoutSource,
  /settings-control-canvas settings-atlas-canvas/,
  'Settings should mount inside the full-bleed atlas canvas instead of the old constrained shell.',
);

assert.match(
  layoutSource,
  /st-hero[\s\S]*st-main-grid[\s\S]*st-main-grid[\s\S]*st-services[\s\S]*st-bottom-grid/,
  'Settings atlas should group profile, preferences, setup, services, and wellness sections explicitly.',
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
  /\.st-main-grid\s*{[\s\S]*?grid-template-columns:\s*1fr\s+1fr/,
  'Desktop settings atlas should use balanced two-column cards instead of a loose three-column layout.',
);

assert.match(
  styleSource,
  /\.settings-control-page \.runner-shell-canvas\.settings-control-canvas,[\s\S]*?\.settings-control-page \.settings-atlas-canvas\s*{[\s\S]*?width:\s*calc\(100% - clamp\(28px,\s*3\.2vw,\s*64px\)\)[\s\S]*?max-width:\s*none !important/,
  'Settings canvas should override the runner-shell max-width and use the available screen width.',
);

assert.match(
  styleSource,
  /\.st-services-grid\s*{[\s\S]*?grid-template-columns:\s*1fr\s+1fr/,
  'Connected services should use a two-column desktop grid instead of leaving empty right-side space.',
);

assert.ok(
  styleSource.lastIndexOf('Settings full-bleed control room pass') > styleSource.lastIndexOf('Runner shell navigation redesign'),
  'The Settings full-bleed override should come after broad runner-shell navigation overrides.',
);

assert.match(
  styleSource,
  /\.st-bottom-grid\s*{[\s\S]*?grid-template-columns:\s*1fr/,
  'The lower Settings area should avoid an empty right rail when only wellness content is present.',
);

assert.match(
  styleSource,
  /@media \(max-width:\s*960px\)\s*{[\s\S]*?\.st-main-grid,[\s\S]*?\.st-services-grid,[\s\S]*?\.st-bottom-grid\s*{[\s\S]*?grid-template-columns:\s*1fr/,
  'The Settings atlas should collapse cleanly before desktop columns become cramped.',
);

assert.match(
  styleSource,
  /\.st-service-meta\s*{[\s\S]*?grid-template-columns:\s*1fr\s+1fr/,
  'Service metadata must stay in readable cards for localized labels.',
);

console.log('[PASS] Settings workbench layout guardrails passed.');
