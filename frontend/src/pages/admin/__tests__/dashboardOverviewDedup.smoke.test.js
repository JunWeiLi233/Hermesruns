import { readDashboardSources } from '../readDashboardSources.mjs';
import assert from 'node:assert/strict';

const dashboardSource = readDashboardSources();

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

assert.match(
  dashboardSource,
  /const catalogReviewSummary = useMemo\(\s*\(\)\s*=>\s*summarizeAdminShoeCatalogStatus\(catalogItems\)/,
  'The overview shoe chart should summarize the shared catalog used by dashboard/shoes.',
);

assert.match(
  dashboardSource,
  /catalogReviewSummary\.live[\s\S]*catalogReviewSummary\.pending[\s\S]*catalogReviewSummary\.missing/,
  'The overview shoe chart should use catalog status counts instead of runner shoe queues.',
);

assert.match(
  dashboardSource,
  /activeTab === 'overview'[\s\S]*loadCatalogInventory\(\)[\s\S]*loadCatalogImageAssets\(\)/,
  'The overview must load the same catalog inventory and image assets as dashboard/shoes before rendering its chart.',
);

console.log('[PASS] Dashboard overview dedup + NaN guardrails passed.');
