import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const profileSource = readFileSync(path.join(here, 'ProfileDashboard.jsx'), 'utf8');

assert.match(
  profileSource,
  /runner-dashboard-bar-tooltip/,
  'Profile weekly progress card should render the weekly bar tooltip.',
);

assert.match(
  profileSource,
  /left:\s*`clamp\(84px,\s*\$\{\(\(activeWeeklyBar\.index \+ 0\.5\) \/ weeklyBars\.length\) \* 100\}%,\s*calc\(100% - 84px\)\)`/,
  'Weekly progress tooltip should clamp its horizontal position instead of snapping awkwardly to the chart edge.',
);

assert.doesNotMatch(
  profileSource,
  /runner-dashboard-bar-tooltip\$\{activeWeeklyBar\.index <= 1 \? ' is-left' : activeWeeklyBar\.index >= 5 \? ' is-right' : ''\}/,
  'Weekly progress tooltip should no longer rely on brittle edge-snap classes for the first and last bars.',
);

console.log('[PASS] Profile weekly progress tooltip guardrails passed.');
