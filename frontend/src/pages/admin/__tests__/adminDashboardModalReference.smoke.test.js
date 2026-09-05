import { readDashboardSources } from '../readDashboardSources.mjs';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const dashboardSource = readDashboardSources();
const modalSource = readFileSync(path.join(here, "../../../components/Modal.jsx"), 'utf8');
const monitoringCss = readFileSync(path.join(here, "../../../styles/admin-monitoring-dashboard.css"), 'utf8');
const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

for (const stateName of [
  'clearJobsModalOpen',
  'Boolean(userBulkModal)',
  'Boolean(selectedUser)',
  'imgPickerOpen',
  'catalogImagePickerOpen',
  'Boolean(catalogDeleteTarget)',
  'Boolean(auditDeleteTarget)',
  'catalogBrandFormOpen',
  'adminShoeFormOpen',
]) {
  assert.match(
    dashboardSource,
    new RegExp(`<Modal\\s+[\\s\\S]*?isOpen=\\{${escapeRegExp(stateName)}\\}[\\s\\S]*?adminDashboard`),
    `Admin modal ${stateName} should use the shared admin dashboard treatment.`,
  );
}

assert.equal(
  (dashboardSource.match(/className="admin-dashboard-modal-icon"/g) || []).length,
  10,
  'Every admin dashboard modal should expose the reference icon badge.',
);
assert.match(modalSource, /adminDashboard\s*=\s*false/);
assert.match(modalSource, /admin-dashboard-modal-shell/);
assert.match(modalSource, /admin-dashboard-modal-card/);

const adminModalShell = monitoringCss.match(/\.admin-dashboard-modal-shell\s*\{([^}]*)\}/)?.[1];
assert.ok(adminModalShell, 'Admin dashboard modal shell should have a dedicated visual treatment.');
assert.match(adminModalShell, /background:\s*rgba\(64,\s*64,\s*64,\s*0\.56\)/);

const adminModalCard = monitoringCss.match(/\.admin-dashboard-modal-card\s*\{([^}]*)\}/)?.[1];
assert.ok(adminModalCard, 'Admin dashboard modal card should have a dedicated visual treatment.');
assert.match(adminModalCard, /border-radius:\s*28px/);
assert.match(adminModalCard, /background:\s*#ffffff\s*!important/);

assert.match(
  monitoringCss,
  /\.admin-dashboard-modal-card \.modal-header-icon\s*\{[\s\S]*?background:\s*#fff0ec/,
);
assert.match(
  monitoringCss,
  /\.admin-dashboard-modal-card \.modal-header-icon\s*\{[\s\S]*?border-radius:\s*50%/,
);
assert.match(
  monitoringCss,
  /\.admin-dashboard-modal-card \.modal-close\s*\{[\s\S]*?background:\s*transparent[\s\S]*?color:\s*#252627/,
);
assert.match(
  monitoringCss,
  /\.admin-dashboard-modal-card \.modal-actions \.btn-primary\s*\{[\s\S]*?background:\s*#f26956/,
);
assert.match(
  monitoringCss,
  /\.admin-dashboard-modal-card \.modal-actions \.btn-secondary\s*\{[\s\S]*?background:\s*#ffffff/,
);

console.log('[PASS] Admin dashboard modals share the reference confirmation design.');
