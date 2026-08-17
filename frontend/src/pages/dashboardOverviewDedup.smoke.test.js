import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const dashboardSource = readFileSync(path.join(here, 'Dashboard.jsx'), 'utf8');

assert.doesNotMatch(
  dashboardSource,
  /ops-metric-kicker/,
  'Metric strip cards should render one label per card; the kicker slot repeated the label translation key.',
);

assert.doesNotMatch(
  dashboardSource,
  /ops-sidebar-brand-wordmark/,
  'Sidebar brand should rely on HermesLogo (icon + HERMES wordmark) instead of printing HERMES twice.',
);

assert.doesNotMatch(
  dashboardSource,
  /admin-command-sidebar__cta/,
  'Sidebar footer CTA duplicated the course-maps nav item; the nav item already navigates there.',
);

assert.match(
  dashboardSource,
  /const toCount = \(value\) => \(Array\.isArray\(value\) \? value\.length : Number\(value\) \|\| 0\);/,
  'Queue counts must coerce arrays to length and non-numeric values to 0 instead of rendering NaN.',
);

assert.doesNotMatch(
  dashboardSource,
  /Number\(queues\./,
  'Raw Number() coercion over queue payload fields produces NaN when the API sends arrays.',
);

console.log('[PASS] Dashboard overview dedup + NaN guardrails passed.');
