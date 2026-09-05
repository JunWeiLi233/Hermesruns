import { readDashboardSources } from '../readDashboardSources.mjs';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const dashboardSource = readDashboardSources();
const adminStyles = readFileSync(path.join(here, "../../../styles/admin-kinetic-editorial.css"), 'utf8');

assert.match(
  dashboardSource,
  /className="ops-health-label"/,
  'Dashboard status rows should expose a dedicated label column for alignment.',
);

assert.match(
  adminStyles,
  /\.dashboard-body\.admin-command-page \.ops-health-row\s*\{[\s\S]*?display:\s*grid;[\s\S]*?grid-template-columns:\s*8px\s+minmax\(0,\s*1fr\)\s+auto;/,
  'Dashboard status rows should use a stable three-column grid.',
);

assert.match(
  adminStyles,
  /\.dashboard-body\.admin-command-page \.ops-health-label\s*\{[\s\S]*?text-align:\s*center;/,
  'Dashboard status labels should share the same centered vertical axis.',
);

console.log('[PASS] Dashboard status-label alignment guardrail passed.');
