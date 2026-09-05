import { readDashboardSources } from '../readDashboardSources.mjs';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const dashboardSource = readDashboardSources();
const englishSource = readFileSync(path.join(here, "../../../i18n/locales/en/components.js"), 'utf8');
const chineseSource = readFileSync(path.join(here, "../../../i18n/locales/zh-CN/components.js"), 'utf8');
const monitoringCss = readFileSync(path.join(here, "../../../styles/admin-monitoring-dashboard.css"), 'utf8');

assert.match(
  dashboardSource,
  /apiJson\('\/api\/admin\/jobs',\s*\{ method: 'DELETE' \}\)/,
  'The Jobs dashboard should call the admin clear-history endpoint.',
);
assert.doesNotMatch(
  dashboardSource,
  /window\.confirm\(t\('dashboard\.confirm_clear_jobs'\)\)/,
  'Clearing job history should use the designed modal instead of a native prompt.',
);
assert.match(dashboardSource, /clearJobsModalOpen/);
assert.match(dashboardSource, /isOpen=\{clearJobsModalOpen\}/);
assert.match(dashboardSource, /admin-jobs-clear-modal/);
assert.match(dashboardSource, /jobs_clear_modal_title/);
assert.match(dashboardSource, /jobs_clear_modal_confirm/);
assert.match(
  monitoringCss,
  /\.admin-jobs-clear-modal__warning-icon\s*\{[\s\S]*?width:\s*20px;[\s\S]*?height:\s*20px;/,
  'The clear-history warning icon should stay within a compact 20px box.',
);
assert.match(
  dashboardSource,
  /jobs_clear_in_progress.*jobs_clear/s,
  'The clear-history action should expose a busy state while the request runs.',
);
assert.match(englishSource, /"jobs_clear":/);
assert.match(chineseSource, /"jobs_clear":/);
assert.match(englishSource, /"jobs_clear_modal_title":/);
assert.match(chineseSource, /"jobs_clear_modal_title":/);

console.log('[PASS] Jobs dashboard clear-history action is confirmed, localized, and wired to the admin endpoint.');
