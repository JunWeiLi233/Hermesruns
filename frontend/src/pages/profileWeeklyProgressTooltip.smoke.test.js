import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const profileSource = readFileSync(path.join(here, 'ProfileDashboard.jsx'), 'utf8');
const styleSource = readFileSync(path.join(here, '../styles/style.css'), 'utf8');

assert.match(
  profileSource,
  /hd-bar-tooltip/,
  'Profile weekly progress card should render the weekly bar tooltip.',
);

assert.match(
  profileSource,
  /onMouseEnter=\{\(\) => setActiveWeeklyBar\(bar\)\}[\s\S]*onMouseLeave=\{\(\) => setActiveWeeklyBar\(null\)\}/,
  'Weekly progress tooltip should be driven by the hovered weekly bar.',
);

assert.match(
  styleSource,
  /\.hd-bar-tooltip\s*\{/,
  'Profile weekly progress tooltip should have a dedicated style hook.',
);

assert.doesNotMatch(
  profileSource,
  /runner-dashboard-bar-tooltip\$\{activeWeeklyBar\.index <= 1 \? ' is-left' : activeWeeklyBar\.index >= 5 \? ' is-right' : ''\}/,
  'Weekly progress tooltip should no longer rely on brittle edge-snap classes for the first and last bars.',
);

console.log('[PASS] Profile weekly progress tooltip guardrails passed.');
