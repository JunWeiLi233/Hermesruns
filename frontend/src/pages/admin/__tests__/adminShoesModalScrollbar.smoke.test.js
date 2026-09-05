import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const monitoringCss = readFileSync(path.join(here, "../../../styles/admin-monitoring-dashboard.css"), 'utf8');

const dashboardModalForm = monitoringCss.match(/\.admin-catalog-modal-card \.modal-form,\s*\.admin-dashboard-modal-card--wide \.modal-form\s*\{([^}]*)\}/)?.[1];
assert.ok(dashboardModalForm, 'The dashboard shoes editors should have a dedicated scrolling form rule.');
assert.match(dashboardModalForm, /overflow-y:\s*auto/);
assert.match(dashboardModalForm, /scrollbar-width:\s*none/);
assert.match(dashboardModalForm, /-ms-overflow-style:\s*none/);
assert.match(dashboardModalForm, /scrollbar-gutter:\s*auto/);

const webkitScrollbar = monitoringCss.match(/\.admin-catalog-modal-card \.modal-form::-[\w-]+scrollbar,\s*\.admin-dashboard-modal-card--wide \.modal-form::-[\w-]+scrollbar\s*\{([^}]*)\}/)?.[1];
assert.ok(webkitScrollbar, 'The dashboard shoes editors should define a hidden WebKit scrollbar.');
assert.match(webkitScrollbar, /display:\s*none/);
assert.match(webkitScrollbar, /width:\s*0/);
assert.match(webkitScrollbar, /height:\s*0/);

console.log('admin shoes modal scrollbar smoke test passed');
