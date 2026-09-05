import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const indexSource = readFileSync(path.join(here, "../../index.css"), 'utf8');
const styleSource = readFileSync(path.join(here, "../../styles/all-pages-liquid-glass.css"), 'utf8');

assert.ok(
  indexSource.indexOf("@import './styles/all-pages-liquid-glass.css';")
    > indexSource.indexOf("@import './styles/_split/profile.css';"),
  'The profile-aligned runner layer must load after route-specific styles.',
);

for (const token of [
  '--runner-profile-paper',
  '--runner-profile-card',
  '--runner-profile-ink',
  '--runner-profile-muted',
  '--runner-profile-line',
  '--runner-profile-flame',
  '--runner-profile-action-bg',
  '--runner-profile-action-ink',
]) {
  assert.match(styleSource, new RegExp(token), `Runner profile system should define ${token}.`);
}

assert.match(
  styleSource,
  /body\.theme-light \.runner-shell-page\s*\{[\s\S]*radial-gradient\(circle at 10% 8%/,
  'Runner pages should use the warm profile background in light mode.',
);

assert.match(
  styleSource,
  /\.runner-dashboard-page \.runner-shell-canvas\s*\{[\s\S]*width:\s*calc\(100% - 24px\)[\s\S]*margin:\s*0 12px[\s\S]*padding:\s*24px 20px 52px/,
  'Desktop runner pages should share the profile canvas geometry.',
);

for (const selector of [
  '.analysis-profile-primary',
  '.heatmap-page-legend-card',
  '.shoe-inventory-card',
  '.mt-top-panel',
  '.recent-runs-card',
  '.schedule-plan-week-card',
]) {
  assert.match(styleSource, new RegExp(selector.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&')), `Profile surfaces should cover ${selector}.`);
}

assert.match(
  styleSource,
  /\.runner-dashboard-page :is\([\s\S]*\.integration-alert-primary-btn,[\s\S]*\.btn-primary[\s\S]*\)\s*\{[\s\S]*border-radius:\s*999px[\s\S]*background:\s*var\(--runner-profile-action-bg\)[\s\S]*color:\s*var\(--runner-profile-action-ink\)/,
  'Runner primary actions should use the profile pill treatment with theme-safe contrast.',
);

assert.match(
  styleSource,
  /\.runner-dashboard-page :is\([\s\S]*\.race-leaflet-map,[\s\S]*\.heatmap-page-map-shell[\s\S]*\)\s*\{[\s\S]*overflow:\s*hidden/,
  'Maps and chart shells should keep their interaction surfaces while sharing the profile radius.',
);

assert.match(
  styleSource,
  /@media \(prefers-reduced-motion: reduce\)\s*\{[\s\S]*\.runner-dashboard-page :is\([\s\S]*\.mt-exercise-list > \*/,
  'Profile-aligned motion must remain disabled for reduced-motion users.',
);

console.log('[PASS] Runner profile design system guardrails passed.');
