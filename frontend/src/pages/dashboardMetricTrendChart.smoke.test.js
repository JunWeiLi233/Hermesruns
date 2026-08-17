import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const dashboardSource = readFileSync(path.join(here, 'Dashboard.jsx'), 'utf8');
const enAdmin = readFileSync(path.join(here, '../i18n/locales/en/admin.js'), 'utf8');
const zhAdmin = readFileSync(path.join(here, '../i18n/locales/zh-CN/admin.js'), 'utf8');

const TREND_KEYS = [
  'metric_trend_kicker',
  'metric_trend_users_title',
  'metric_trend_shoes_title',
  'metric_trend_dataset',
  'metric_trend_axis_date',
  'metric_trend_axis_count',
  'metric_trend_loading',
  'metric_trend_empty',
  'metric_trend_error',
  'metric_trend_session_expired',
  'metric_trend_close',
];

assert.match(
  dashboardSource,
  /className=\{`ops-metric-card ops-metric-card--toggle\$\{metricTrendTab === 'users' \? ' is-active' : ''\}`\}/,
  'The Active Athletes metric card must be a toggle button bound to the users trend.',
);

assert.match(
  dashboardSource,
  /className=\{`ops-metric-card ops-metric-card--toggle\$\{metricTrendTab === 'shoes' \? ' is-active' : ''\}`\}/,
  'The Shoes Inventory metric card must be a toggle button bound to the shoes trend.',
);

assert.match(
  dashboardSource,
  /aria-pressed=\{metricTrendTab === 'users'\}/,
  'Toggle metric cards must expose aria-pressed state.',
);

assert.match(
  dashboardSource,
  /onClick=\{\(\) => toggleMetricTrend\('users'\)\}/,
  'Clicking the Active Athletes card must toggle the users trend chart.',
);

assert.match(
  dashboardSource,
  /onClick=\{\(\) => toggleMetricTrend\('shoes'\)\}/,
  'Clicking the Shoes Inventory card must toggle the shoes trend chart.',
);

assert.match(
  dashboardSource,
  /<Line\s/,
  'The trend panel must render a Chart.js line graph.',
);

assert.match(
  dashboardSource,
  /const METRIC_TREND_MAX_PAGES = \d+;/,
  'Trend fetching must be page-capped so a large dataset cannot loop unbounded.',
);

assert.match(
  dashboardSource,
  /function buildCumulativeDailySeries\(/,
  'Trend series must be built from a cumulative daily aggregation.',
);

assert.doesNotMatch(
  dashboardSource,
  /\[metricTrendTab, metricTrends\]/,
  'The trend effect must not depend on metricTrends: writing the loading entry re-runs the effect, cancels the in-flight fetch, and leaves the chart stuck on loading.',
);

assert.match(
  dashboardSource,
  /const metricTrendFetchedRef = useRef\(\{\}\);/,
  'Trend fetching must use a ref-based once-per-metric guard so re-renders never cancel or skip the fetch.',
);

assert.match(
  dashboardSource,
  /err\?\.status === 401 \|\| err\?\.status === 403/,
  'A 401/403 trend failure must surface a session-expired message instead of a generic error.',
);

for (const key of TREND_KEYS) {
  assert.ok(enAdmin.includes(`"${key}"`), `English admin locale is missing key "${key}".`);
  assert.ok(zhAdmin.includes(`"${key}"`), `zh-CN admin locale is missing key "${key}".`);
}

console.log('[PASS] Dashboard metric trend chart contract passed.');
