import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const dashboardSource = readFileSync(path.join(here, 'Dashboard.jsx'), 'utf8');

assert.match(
  dashboardSource,
  /const courseMapDisplaySummary = courseMapDisplayPreview\?\.summary \|\| '';/,
  'Dashboard should derive a visible course-map summary from the currently displayed preview.',
);

assert.match(
  dashboardSource,
  /courseMapDisplaySummary \? \(\s*<p className="admin-coursemap-rework__summary">\{courseMapLocalizedSummary\}<\/p>/,
  'Dashboard should surface the active course-map summary in the rework decision card.',
);

console.log('[PASS] Dashboard course-map summary surface guard passed.');
