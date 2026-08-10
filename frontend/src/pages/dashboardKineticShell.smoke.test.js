import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const dashboardSource = readFileSync(path.join(here, 'Dashboard.jsx'), 'utf8');
const styleSource = readFileSync(path.join(here, '../styles/style.css'), 'utf8');
const kineticStyleSource = readFileSync(path.join(here, '../styles/admin-kinetic-editorial.css'), 'utf8');

assert.match(
  dashboardSource,
  /admin-command-sidebar/,
  'Dashboard should expose the kinetic admin sidebar shell instead of relying only on a flat tab row.',
);

assert.match(
  dashboardSource,
  /admin-overview-hud/,
  'Dashboard overview should render a dedicated HUD hero area for the transplant-style top fold.',
);

assert.match(
  dashboardSource,
  /admin-overview-bento/,
  'Dashboard overview should use a stronger bento layout instead of a generic metrics wall.',
);

assert.match(
  dashboardSource,
  /admin-overview-users-tracks/,
  'Dashboard overview should render the users-and-tracks row from the kinetic admin composition.',
);

assert.match(
  dashboardSource,
  /admin-overview-review-feed/,
  'Dashboard overview should render the lower review-feed row instead of stopping at KPI panels.',
);

assert.match(
  dashboardSource,
  /admin-shoe-workbench/,
  'Dashboard shoes tab should render a dedicated workbench instead of only a flat asset grid.',
);

assert.match(
  dashboardSource,
  /admin-shoe-workbench__queue/,
  'Dashboard shoes tab should keep a queue rail for review-first shoe operations.',
);

assert.match(
  styleSource,
  /\.admin-command-sidebar\s*\{/,
  'Dashboard styles should define the transplant-inspired admin sidebar.',
);

assert.match(
  styleSource,
  /\.admin-overview-hud\s*\{/,
  'Dashboard styles should define the overview HUD hero.',
);

assert.match(
  styleSource,
  /\.admin-overview-users-tracks\s*\{/,
  'Dashboard styles should define the users-and-tracks overview row.',
);

assert.match(
  styleSource,
  /\.admin-overview-review-feed\s*\{/,
  'Dashboard styles should define the lower review-feed overview row.',
);

assert.match(
  styleSource,
  /\.admin-shoe-workbench\s*\{/,
  'Dashboard styles should define the shoe workbench layout.',
);

assert.doesNotMatch(
  dashboardSource,
  /\bad-(?:content|sidebar|topbar|page|metric|action|two-col|health|audit|card|search|status|role|tier|avatar|course|settings|option|shell)\b/,
  'Dashboard markup should avoid ad-prefixed classes that browser content blockers can hide.',
);

assert.doesNotMatch(
  styleSource,
  /\.ad-(?:content|sidebar|topbar|page|metric|action|two-col|health|audit|card|search|status|role|tier|avatar|course|settings|option|shell)\b/,
  'Dashboard styles should avoid ad-prefixed selectors that browser content blockers can hide.',
);

assert.match(
  kineticStyleSource,
  /admin-command-layout[\s\S]*grid-template-columns:\s*var\(--admin-command-rail-width,\s*240px\)\s+minmax\(0,\s*1fr\)/,
  'Desktop dashboard shell should keep the command rail and content in one row.',
);

assert.match(
  kineticStyleSource,
  /admin-command-main\.ops-content[\s\S]*margin-left:\s*0/,
  'Desktop dashboard content should not be pushed below or away from the command rail.',
);

console.log('[PASS] Dashboard kinetic shell guardrails passed.');
