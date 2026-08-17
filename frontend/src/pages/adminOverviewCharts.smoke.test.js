import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const dashboardSource = readFileSync(path.join(here, './Dashboard.jsx'), 'utf8');
const kineticStyleSource = readFileSync(
  path.join(here, '../styles/admin-kinetic-editorial.css'),
  'utf8',
);
const zhAdmin = readFileSync(path.join(here, '../i18n/locales/zh-CN/admin.js'), 'utf8');
const enAdmin = readFileSync(path.join(here, '../i18n/locales/en/admin.js'), 'utf8');

// DV-2026-08-15-30 — the overview renders reference-style graphs: user growth
// line, audit events per day bars, and a shoe photo status doughnut.
assert.match(
  dashboardSource,
  /ops-chart-grid[\s\S]*?chart_users_title[\s\S]*?<Line[\s\S]*?chart_audit_title[\s\S]*?<Bar[\s\S]*?chart_shoes_title[\s\S]*?<Doughnut/,
  'Overview should render the line/bar/doughnut chart row.'
);
assert.match(
  dashboardSource,
  /buildDailyCountSeries\(items\)/,
  'Audit chart should bucket events per day.'
);
assert.match(
  dashboardSource,
  /fetchMetricTrendItems\('\/api\/admin\/audit'\)/,
  'Audit chart should page the audit API for dated events.'
);

assert.match(
  kineticStyleSource,
  /\.dashboard-body\.admin-command-page \.ops-chart-grid\s*\{[^}]*grid-template-columns:\s*repeat\(auto-fit, minmax\(300px, 1fr\)\)/,
  'Charts should lay out in a responsive auto-fit grid.'
);

// Chart copy exists in both locales.
for (const [name, src] of [['zh-CN', zhAdmin], ['en', enAdmin]]) {
  for (const key of ['charts_kicker', 'chart_users_title', 'chart_audit_title', 'chart_shoes_title', 'chart_audit_dataset', 'chart_shoes_label_live', 'chart_loading', 'chart_error']) {
    assert.ok(src.includes(`"${key}":`), `${name} admin locale should define ${key}.`);
  }
}
