import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const runsStyleSource = readFileSync(path.join(here, '../styles/_split/runs.css'), 'utf8');
const parityBlock = runsStyleSource.slice(runsStyleSource.indexOf('/* Runs page scale parity */'));

assert.notEqual(
  parityBlock,
  runsStyleSource,
  'Runs should define a final scale-parity cascade after compact composition rules.',
);

assert.match(
  parityBlock,
  /\.runs-dashboard-page \.runs-profile-history\s*\{[\s\S]*?max-width:\s*none;[\s\S]*?gap:\s*clamp\(16px, 2vw, 24px\);/,
  'Runs history should use the full runner canvas instead of a zoomed-out max-width.',
);

assert.match(
  parityBlock,
  /\.runs-dashboard-page \.runs-profile-cockpit h1\s*\{[\s\S]*?font-size:\s*clamp\(2\.8rem, 6\.2vw, 5\.8rem\);[\s\S]*?line-height:\s*0\.9;/,
  'Runs headline typography should match the normal Profile-aligned scale.',
);

assert.match(
  parityBlock,
  /\.runs-dashboard-page \.runs-profile-history button\.recent-runs-card\s*\{[\s\S]*?min-height:\s*220px;[\s\S]*?padding:\s*16px;/,
  'Run cards should not use the compact 166px presentation.',
);

console.log('[PASS] Runs page scale parity guardrails passed.');
