import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const runsSource = readFileSync(path.join(here, 'Runs.jsx'), 'utf8');
const runsStyles = readFileSync(path.join(here, '../styles/_split/runs.css'), 'utf8');

assert.doesNotMatch(
  runsSource,
  /<div className="recent-runs-hero-overlay" \/>/,
  'Runs should not restore the old image-hero overlay after the profile cockpit background removal.',
);

assert.match(
  runsSource,
  /<section className="runs-profile-cockpit" aria-labelledby="runs-profile-title">/,
  'Runs should render the profile-aligned cockpit as the current top surface.',
);

assert.match(
  runsStyles,
  /\.runs-dashboard-page\s+\.runner-shell-canvas\s*\{[\s\S]*background:\s*transparent;/,
  'Runs should keep the route-level background removed so the page reads as separate grid panels.',
);

assert.match(
  runsStyles,
  /\.runs-dashboard-page\s+\.runs-profile-signal--count\s*\{[\s\S]*background:\s*#191512;[\s\S]*color:\s*#fff7ee;/,
  'Runs full-history signal text should remain light on its dark cockpit card.',
);

console.log('[PASS] Runs cockpit contrast guardrails passed.');
