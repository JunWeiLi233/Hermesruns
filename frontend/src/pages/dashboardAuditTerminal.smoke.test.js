import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const dashboardSource = readFileSync(path.join(here, 'Dashboard.jsx'), 'utf8');
const styleSource = readFileSync(path.join(here, '../styles/style.css'), 'utf8');

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
  styleSource,
  /\.admin-audit-terminal__hero\s*\{/,
  'Styles should define the audit terminal hero.',
);

assert.match(
  styleSource,
  /\.admin-audit-terminal__table-shell\s*\{/,
  'Styles should define the audit terminal event shell.',
);

console.log('[PASS] Dashboard audit terminal guardrails passed.');
