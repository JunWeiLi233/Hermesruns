import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const kineticStyles = readFileSync(path.join(here, "../../../styles/admin-kinetic-editorial.css"), 'utf8');

assert.match(
  kineticStyles,
  /\.dashboard-body\.admin-command-page \.ops-metric-card--toggle:hover\s*\{[^}]*border-color:\s*var\(--admin-profile-line[^}]*\}/,
  'Hovering the shoe inventory metric must not reintroduce the coral border.',
);

assert.match(
  kineticStyles,
  /\.dashboard-body\.admin-command-page \.ops-metric-card--toggle:focus-visible\s*\{[^}]*border-color:\s*var\(--admin-profile-line[^}]*box-shadow:\s*0 0 0 3px color-mix\(in srgb, var\(--admin-profile-ink[^}]*\}/,
  'Keyboard focus must keep a neutral, visible ring around the shoe inventory metric.',
);

assert.match(
  kineticStyles,
  /\.dashboard-body\.admin-command-page \.ops-metric-card--toggle\.is-active\s*\{[^}]*border-color:\s*var\(--admin-profile-line[^}]*box-shadow:\s*var\(--admin-profile-shadow-soft[^}]*\}/,
  'The selected shoe inventory metric must keep the neutral card surface instead of a coral highlight ring.',
);

console.log('[PASS] Dashboard metric card surface contract passed.');
