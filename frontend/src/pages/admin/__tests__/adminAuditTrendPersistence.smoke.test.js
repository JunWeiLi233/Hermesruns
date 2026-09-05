import { readDashboardSources } from '../readDashboardSources.mjs';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const dashboardSource = readDashboardSources();
const auditControllerSource = readFileSync(
  path.join(here, "../../../../../backend/src/main/java/com/hermes/backend/admin/AdminAuditPortalController.java"),
  'utf8',
);
const auditServiceSource = readFileSync(
  path.join(here, "../../../../../backend/src/main/java/com/hermes/backend/admin/AdminPortalService.java"),
  'utf8',
);
const auditEntitySource = readFileSync(
  path.join(here, "../../../../../backend/src/main/java/com/hermes/backend/admin/AdminAuditLog.java"),
  'utf8',
);

assert.match(
  dashboardSource,
  /fetchMetricTrendItems\('\/api\/admin\/audit\/trend'[\s\S]*?buildDailyCountSeries\(items, 'createdAt', 14\)/,
  'The overview audit chart should load the durable historical trend endpoint instead of paginated live rows.',
);
assert.match(
  dashboardSource,
  /Number\(item\.count \?\? 1\)/,
  'The chart series builder should use the persisted per-day count returned by the trend endpoint.',
);
assert.match(
  auditControllerSource,
  /@GetMapping\("\/audit\/trend"\)[\s\S]*?auditTrend\(/,
  'The backend should expose a dedicated audit trend endpoint.',
);
assert.match(
  auditServiceSource,
  /List<Map<String, Object>> auditTrend\(int days\)/,
  'The admin service should build the historical audit trend independently of live-row pagination.',
);
assert.match(
  auditEntitySource,
  /private LocalDateTime deletedAt/,
  'Audit rows should retain a deletion timestamp instead of being physically removed.',
);

console.log('[PASS] Audit chart reads durable history independent of live audit deletions.');
