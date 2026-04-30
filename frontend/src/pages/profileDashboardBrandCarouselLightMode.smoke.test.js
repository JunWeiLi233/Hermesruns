import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const profileSource = readFileSync(path.join(here, 'ProfileDashboard.jsx'), 'utf8');
const styleSource = readFileSync(path.join(here, '../styles/style.css'), 'utf8');

assert.match(
  profileSource,
  /dashboardQuickPreview/,
  'Profile dashboard brand carousel should be driven by a user-data quick preview model.',
);

assert.match(
  profileSource,
  /runner-dashboard-brand-preview-grid/,
  'Profile dashboard brand carousel should render a quick-preview data grid.',
);

assert.doesNotMatch(
  profileSource,
  /brandMsgIndex|runner-dashboard-brand-copy-carousel|runner-dashboard-brand-dots/,
  'Profile dashboard brand carousel should not keep the old rotating brand-message state or dot UI.',
);

assert.match(
  styleSource,
  /body:is\(\.theme-light, \.theme-high-contrast-light\) \.runner-dashboard-brand-carousel\s*\{[\s\S]*background:[\s\S]*linear-gradient[\s\S]*border:/,
  'Brand carousel needs a light-mode card background and border.',
);

assert.match(
  styleSource,
  /body:is\(\.theme-light, \.theme-high-contrast-light\) \.runner-dashboard-brand-preview-copy h2,[\s\S]*\.runner-dashboard-brand-preview-card strong\s*\{[\s\S]*color:/,
  'Brand carousel quick-preview headline and stat values need light-mode text colors.',
);

assert.match(
  styleSource,
  /body:is\(\.theme-light, \.theme-high-contrast-light\) \.runner-dashboard-brand-preview-copy p,[\s\S]*\.runner-dashboard-brand-preview-card em\s*\{[\s\S]*color:/,
  'Brand carousel quick-preview secondary copy needs light-mode muted text colors.',
);

assert.match(
  styleSource,
  /body:is\(\.theme-light, \.theme-high-contrast-light\) \.runner-dashboard-brand-preview-card\s*\{[\s\S]*background:[\s\S]*border-color:/,
  'Brand carousel quick-preview cards need light-mode surfaces.',
);

assert.doesNotMatch(
  styleSource,
  /runner-dashboard-brand-msg|runner-dashboard-brand-real-stats|runner-dashboard-brand-dots/,
  'Brand carousel styles should not keep the old message carousel selectors.',
);

console.log('[PASS] Profile dashboard brand carousel light-mode guardrails passed.');
