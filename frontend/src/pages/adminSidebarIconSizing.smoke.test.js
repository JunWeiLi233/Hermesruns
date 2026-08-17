import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const kineticStyleSource = readFileSync(
  path.join(here, '../styles/admin-kinetic-editorial.css'),
  'utf8',
);
const darkCohesionSource = readFileSync(
  path.join(here, '../styles/dark-mode-cohesion.css'),
  'utf8',
);

// AppIcon renders viewBox-only SVGs. Without an explicit CSS box they fall
// back to the 300px intrinsic default and get clamped by the container, which
// blew the admin sidebar icons up to ~96px in light theme. Midnight already
// pinned them in dark-mode-cohesion.css; the kinetic sheet must carry the
// light-theme counterpart so both themes keep the same icon box.
assert.match(
  kineticStyleSource,
  /\.dashboard-body\.admin-command-page svg\.material-symbols-outlined\s*\{[^}]*width:\s*1\.15rem;[^}]*height:\s*1\.15rem;/s,
  'Admin command icons need an explicit light-theme size box (1.15rem) in admin-kinetic-editorial.css.',
);

assert.match(
  darkCohesionSource,
  /body\.theme-midnight \.dashboard-body\.admin-command-page svg\.material-symbols-outlined\s*\{[^}]*width:\s*1\.15rem;/s,
  'The midnight counterpart should stay in dark-mode-cohesion.css with matching values.',
);

console.log('[PASS] Admin sidebar icon sizing guardrails passed.');
