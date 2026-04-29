import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const styleSource = readFileSync(path.join(here, '../styles/style.css'), 'utf8');

assert.match(
  styleSource,
  /body:is\(\.theme-light, \.theme-high-contrast-light\) \.runner-dashboard-brand-carousel\s*\{[\s\S]*background:[\s\S]*linear-gradient[\s\S]*border:/,
  'Brand carousel needs a light-mode card background and border.',
);

assert.match(
  styleSource,
  /body:is\(\.theme-light, \.theme-high-contrast-light\) \.runner-dashboard-brand-msg,[\s\S]*\.runner-dashboard-brand-real-stats strong\s*\{[\s\S]*color:/,
  'Brand carousel headline and stat values need light-mode text colors.',
);

assert.match(
  styleSource,
  /body:is\(\.theme-light, \.theme-high-contrast-light\) \.runner-dashboard-brand-real-stats span,[\s\S]*\.runner-dashboard-brand-stats-empty\s*\{[\s\S]*color:/,
  'Brand carousel secondary copy needs light-mode muted text colors.',
);

assert.match(
  styleSource,
  /body:is\(\.theme-light, \.theme-high-contrast-light\) \.runner-dashboard-brand-dots span\s*\{[\s\S]*background:/,
  'Brand carousel pagination dots need light-mode contrast.',
);

console.log('[PASS] Profile dashboard brand carousel light-mode guardrails passed.');
