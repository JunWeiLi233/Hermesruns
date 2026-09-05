import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const runsSource = readFileSync(path.join(here, "../Runs.jsx"), 'utf8');
const runsStyleSource = readFileSync(path.join(here, "../../../styles/_split/runs.css"), 'utf8');
const liquidGlassStyleSource = readFileSync(path.join(here, "../../../styles/all-pages-liquid-glass.css"), 'utf8');
const whiteGridStyleSource = readFileSync(path.join(here, "../../../styles/grid-cards-white.css"), 'utf8');

assert.match(
  runsSource,
  /className="recent-runs-card"[\s\S]*className="recent-runs-card-body"[\s\S]*className="recent-runs-card-top"[\s\S]*recent-runs-card-date[\s\S]*recent-runs-card-metrics/,
  'Run history should keep its card body, title/date region, and metric grid structure.',
);

assert.match(
  runsStyleSource,
  /\.runs-dashboard-page \.runs-profile-history \.recent-runs-month-group\s*\{[^}]*border-radius:\s*24px;[^}]*overflow:\s*hidden;/,
  'Month groups should clip their white header surface inside the same rounded grid container as the other Runs cards.',
);

assert.match(
  runsStyleSource,
  /\.runs-dashboard-page \.runner-shell-canvas::before\s*\{[^}]*content:\s*none !important;/,
  'The shared canvas decoration should not leave a rounded surface in the Runs page gutter.',
);

assert.match(
  liquidGlassStyleSource,
  /Run-history cards have the same `-card` naming collision[\s\S]*\.runner-shell-page\.runs-dashboard-page \.runs-profile-history :is\([\s\S]*\.recent-runs-card-body,[\s\S]*\.recent-runs-card-top,[\s\S]*\.recent-runs-card-date,[\s\S]*\.recent-runs-card-metrics[\s\S]*\)\s*\{[\s\S]*background:\s*transparent !important;[\s\S]*background-image:\s*none !important;[\s\S]*box-shadow:\s*none !important;[\s\S]*backdrop-filter:\s*none !important;/,
  'Run-history content wrappers should not render accidental liquid-glass strips.',
);

assert.match(
  liquidGlassStyleSource,
  /\.runner-shell-page\.runs-dashboard-page \.runs-profile-history :is\([\s\S]*\.recent-runs-card-metrics[\s\S]*\)/,
  'The reset should stop at the metric-grid wrapper so individual metric tiles retain their own treatment.',
);

assert.match(
  liquidGlassStyleSource,
  /The profile-aligned card gradient is the remaining full-width strip[\s\S]*\.runner-shell-page\.runs-dashboard-page \.runs-profile-history button\.recent-runs-card\s*\{[\s\S]*background:\s*transparent !important;[\s\S]*background-image:\s*none !important;/,
  'The run card itself should not paint a full-width strip behind the content column.',
);

assert.doesNotMatch(
  liquidGlassStyleSource,
  /\.runner-shell-page \.runs-dashboard-page \.runs-profile-history/,
  'Run-history strip resets must not use a descendant selector for classes that share the page root.',
);

assert.match(
  whiteGridStyleSource,
  /body:is\(\.theme-light, \.theme-high-contrast-light\) #root \.runs-dashboard-page \.runs-profile-history :is\(\s*button\.recent-runs-card,\s*\.recent-runs-month-group,\s*\.recent-runs-month-header,\s*\.recent-runs-card-metric,\s*\.recent-runs-card-metric--accent\s*\)\s*\{[\s\S]*background:\s*#ffffff !important;[\s\S]*background-image:\s*none !important;/,
  'Light-theme run history grids should use solid white surfaces for the card, month group, header, and metric tiles.',
);

assert.match(
  whiteGridStyleSource,
  /body:is\(\.theme-light, \.theme-high-contrast-light\) #root \.runs-dashboard-page \.runs-profile-history \.recent-runs-card-list\s*\{[\s\S]*background:\s*transparent !important;[\s\S]*background-image:\s*none !important;/,
  'The Runs history list should stay transparent so separate grids do not merge into one white surface.',
);

assert.match(
  whiteGridStyleSource,
  /body:is\(\.theme-light, \.theme-high-contrast-light\) #root \.runs-dashboard-page \.runner-shell-canvas\s*\{[\s\S]*background:\s*transparent !important;/,
  'The Runs canvas should stay transparent so separate grids do not merge into one white surface.',
);

assert.match(
  whiteGridStyleSource,
  /body:is\(\.theme-light, \.theme-high-contrast-light\) #root \.runs-dashboard-page \.runs-profile-history \.recent-runs-status--loading\s*\{[\s\S]*background:\s*#ffffff !important;[\s\S]*background-image:\s*none !important;/,
  'The Runs loading status should keep its own solid white surface.',
);

assert.match(
  whiteGridStyleSource,
  /body:is\(\.theme-light, \.theme-high-contrast-light\) #root \.runs-dashboard-page \.runner-shell-canvas::before\s*\{[\s\S]*opacity:\s*0 !important;[\s\S]*background:\s*none !important;/,
  'The Runs canvas should not paint the decorative warm grid over the white loading surface.',
);

assert.match(
  whiteGridStyleSource,
  /body:is\(\.theme-light, \.theme-high-contrast-light\) #root \.runs-dashboard-page \.runs-profile-history \.recent-runs-status--loading\s*\{[\s\S]*color:\s*var\(--runs-profile-ink\) !important;/,
  'The localized loading copy should remain readable on the white loading surface.',
);

assert.match(
  whiteGridStyleSource,
  /body:is\(\.theme-light, \.theme-high-contrast-light\) #root \.runs-dashboard-page \.runs-profile-history \.recent-runs-status--loading::after\s*\{[\s\S]*content:\s*none !important;[\s\S]*background:\s*none !important;[\s\S]*animation:\s*none !important;/,
  'The Runs loading grid should remove the light-red loading strip while keeping the loading copy.',
);

assert.match(
  runsSource,
  /className="recent-runs-status recent-runs-status--loading">\{t\('runs\.loading'\)\}/,
  'The Runs loading grid should keep its localized loading copy.',
);

console.log('[PASS] Run-history grid background guardrails passed.');
