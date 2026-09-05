import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const profileSource = readFileSync(path.join(here, "../ProfileDashboard.jsx"), 'utf8');
const contrastSource = readFileSync(path.join(here, "../../../styles/contrast-fixes.css"), 'utf8');

assert.match(
  profileSource,
  /className="hd-today-card"[\s\S]*className="hd-today-bg"[\s\S]*className="hd-today-bg-overlay"[\s\S]*className="hd-today-content"/,
  'Profile should keep the layered Today session card structure.',
);

assert.match(
  contrastSource,
  /Profile today's session card contrast repair[\s\S]*\.hd-today-card\s*\{[\s\S]*background:[\s\S]*linear-gradient\([\s\S]*!important;/,
  'The light-theme Today session card should have a stable dark scrim.',
);

assert.match(
  contrastSource,
  /\.hd-today-card \.hd-today-bg-overlay\s*\{[\s\S]*rgba\(18, 13, 10, 0\.9\)/,
  'The Today session image overlay should provide enough left-side darkness for copy.',
);

assert.match(
  contrastSource,
  /\.hd-today-card :is\(\.hd-today-title, \.hd-today-stat strong\)\s*\{[\s\S]*color:\s*#fff8f1 !important;/,
  'The Today session title and metric values should stay readable over the image.',
);

assert.match(
  contrastSource,
  /\.hd-today-card :is\(\.hd-today-purpose, \.hd-today-stat-label\)\s*\{[\s\S]*color:\s*rgba\(255, 248, 241, 0\.9\) !important;/,
  'The Today session supporting copy and metric labels should stay readable over the image.',
);

console.log('[PASS] Profile Today session card contrast guardrails passed.');
