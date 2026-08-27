import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const dashboardSource = readFileSync(path.join(here, 'Dashboard.jsx'), 'utf8');
const styleSource = readFileSync(path.join(here, '../styles/style.generated.css'), 'utf8');
const zhComponents = readFileSync(path.join(here, '../i18n/locales/zh-CN/components.js'), 'utf8');
const enComponents = readFileSync(path.join(here, '../i18n/locales/en/components.js'), 'utf8');

assert.match(
  dashboardSource,
  /admin-audit-terminal__hero/,
  'Dashboard audit route should render a dedicated terminal hero instead of only a bare data table.',
);

assert.match(
  dashboardSource,
  /admin-audit-terminal__metrics/,
  'Dashboard audit route should surface telemetry metrics above the event table.',
);

assert.match(
  dashboardSource,
  /admin-audit-terminal__table-shell/,
  'Dashboard audit route should wrap the audit rows in a terminal-style event shell.',
);

assert.match(
  dashboardSource,
  /admin-audit-terminal__cta-grid/,
  'Dashboard audit route should expose lower drill-down cards for follow-up audit actions.',
);

assert.match(
  dashboardSource,
  /api\/admin\/audit\/\$\{id\}.*method: 'DELETE'/s,
  'Dashboard audit rows should delete the selected record through the server API.',
);

assert.match(
  dashboardSource,
  /admin-audit-terminal__delete/,
  'Dashboard audit rows should expose a dedicated delete button.',
);

assert.match(
  dashboardSource,
  /admin-audit-terminal__clear/,
  'Dashboard audit should expose a clear-history control in the event-list toolbar.',
);

assert.match(
  dashboardSource,
  /api\/admin\/audit',\s*\{ method: 'DELETE' \}/,
  'Dashboard audit clear-history should use the server bulk-delete endpoint.',
);

assert.match(
  dashboardSource,
  /const \[auditClearModalOpen, setAuditClearModalOpen\] = useState\(false\)/,
  'Audit clear-history should keep confirmation visibility in dedicated modal state.',
);

assert.match(
  dashboardSource,
  /audit_delete_modal_title/,
  'Audit deletion should require an explicit dashboard-modal confirmation.',
);

assert.match(
  dashboardSource,
  /const \[auditDeleteTarget, setAuditDeleteTarget\] = useState\(null\)/,
  'Audit deletion should keep the selected entry in modal state instead of relying on a browser prompt.',
);

assert.doesNotMatch(
  dashboardSource,
  /window\.confirm\(t\('dashboard\.confirm_delete_audit'\)\)/,
  'Audit deletion should use the designed dashboard modal rather than a browser confirm dialog.',
);

assert.match(
  dashboardSource,
  /window\.setTimeout\(\(\) => setMessage\(''\), 3000\)/,
  'Dashboard status messages should dismiss themselves after three seconds.',
);

assert.match(
  dashboardSource,
  /admin-shoe-status dashboard-message dashboard-message--toast/,
  'Dashboard status messages should render as the dedicated toast surface.',
);

assert.match(
  dashboardSource,
  /isOpen=\{Boolean\(auditDeleteTarget\)\}[\s\S]*admin-audit-delete-modal/,
  'Dashboard audit deletion should render the custom confirmation modal for the selected entry.',
);

assert.match(
  dashboardSource,
  /isOpen=\{auditClearModalOpen\}[\s\S]*admin-audit-clear-modal/,
  'Dashboard audit clearing should render a custom confirmation modal before deletion.',
);

assert.match(
  dashboardSource,
  /confirmAuditDelete/,
  'The audit confirmation modal should keep the destructive request behind an explicit confirm action.',
);

assert.match(
  dashboardSource,
  /clearAuditHistory/,
  'The audit clear modal should keep the destructive request behind an explicit confirm action.',
);

assert.match(
  styleSource,
  /\.admin-audit-delete-modal\s*\{/,
  'Styles should define the audit delete confirmation surface.',
);

assert.match(
  styleSource,
  /\.admin-audit-clear-modal\s*\{/,
  'Styles should define the audit clear confirmation surface.',
);

assert.match(
  styleSource,
  /\.dashboard-message\.dashboard-message--toast\s*\{[\s\S]*position:\s*fixed;[\s\S]*bottom:[^;]+;[\s\S]*background:\s*#edf8f0;[\s\S]*color:\s*#2d7a45;/,
  'Dashboard status messages should be fixed above the bottom edge with green reminder styling.',
);

assert.match(
  zhComponents,
  /"audit_delete_modal_title":\s*"删除审计记录？"[\s\S]*"audit_delete_modal_confirm":\s*"删除"/,
  'The audit delete modal should have Chinese title and confirm copy.',
);

assert.match(
  enComponents,
  /"audit_delete_modal_title":\s*"Delete audit record\?"[\s\S]*"audit_delete_modal_confirm":\s*"Delete"/,
  'The audit delete modal should have English title and confirm copy.',
);

assert.match(
  zhComponents,
  /"audit_clear_modal_title":\s*"清空审计历史"[\s\S]*"audit_clear_modal_confirm":\s*"确认清空"/,
  'The audit clear modal should have Chinese title and confirm copy.',
);

assert.match(
  enComponents,
  /"audit_clear_modal_title":\s*"Clear audit history"[\s\S]*"audit_clear_modal_confirm":\s*"Clear history"/,
  'The audit clear modal should have English title and confirm copy.',
);

assert.match(
  styleSource,
  /\.admin-audit-terminal__hero\s*\{/,
  'Styles should define the audit terminal hero.',
);

assert.match(
  styleSource,
  /\.admin-audit-terminal__table-shell\s*\{/,
  'Styles should define the audit terminal event shell.',
);

assert.match(
  styleSource,
  /\.admin-audit-terminal__delete\s*\{/,
  'Styles should define the audit delete button.',
);

console.log('[PASS] Dashboard audit terminal guardrails passed.');
