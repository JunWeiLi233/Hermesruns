import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const dashboardSource = readFileSync(path.join(here, './Dashboard.jsx'), 'utf8');
const adminCss = readFileSync(path.join(here, '../styles/_split/admin.css'), 'utf8');
const courseMapCss = readFileSync(path.join(here, '../styles/admin-monitoring-dashboard.css'), 'utf8');

assert.match(
  dashboardSource,
  /className=\{`admin-track-hub-map-panel__badge is-\$\{liveCourseMapPreview \? 'live' : 'missing'\}`\}[\s\S]*?\{liveCourseMapBadgeValue\}/,
  'Course-map compare panels should render the confidence value through the badge hook.',
);

assert.match(
  adminCss,
  /\.admin-track-hub-map-panel__badge\s*\{[^}]*display:\s*inline-flex;[^}]*align-items:\s*center;[^}]*justify-content:\s*center;/,
  'Course-map confidence badges should center their percentage content inside the pill.',
);

assert.match(
  courseMapCss,
  /\.admin-command-page \.admin-command-route--courseMaps \.admin-track-hub-map-panel__badge\s*\{[^}]*display:\s*inline-flex;[^}]*align-items:\s*center;[^}]*justify-content:\s*center;[^}]*text-align:\s*center;[^}]*line-height:\s*1;/,
  'Course-map confidence badges should keep their content centered in the final route cascade.',
);

console.log('[PASS] Course-map confidence badge content stays centered.');
