import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const componentSource = readFileSync(path.join(here, 'RunsSubpageNav.jsx'), 'utf8');
const styleSource = readFileSync(path.join(here, '../styles/runs-subnav.css'), 'utf8');

assert.match(
  componentSource,
  /runner-shell-side-nav runs-subnav-nav/,
  'The run-detail sidebar should use the exact shared Analysis command-rail primitive.',
);

assert.match(
  componentSource,
  /runner-shell-side-link runs-subnav-link/,
  'Run-detail sections should inherit the shared numbered-row geometry and active state.',
);

assert.match(
  componentSource,
  /aria-controls="runs-subnav-recent-list"[\s\S]*aria-expanded=\{recentRunsOpen\}/,
  'Recent runs should stay available through a compact disclosure instead of permanently filling the rail.',
);

assert.match(
  componentSource,
  /onClick=\{\(\) => navigate\('\/today-run'\)\}[\s\S]*analysis\.pred_open_today/,
  'The lower rail CTA should match Analysis and lead to Today Run.',
);

assert.match(
  componentSource,
  /runs-subnav-import-secondary[\s\S]*navigate\('\/settings\/import-data'\)/,
  'Import navigation should remain available inside the recent-run disclosure.',
);

assert.match(
  styleSource,
  /\.runs-subnav-group\s*\{[\s\S]*display:\s*contents;/,
  'The nested run-detail groups should remain part of the shared numbered rail sequence.',
);

assert.match(
  styleSource,
  /\.runs-subnav-current\s*\{[\s\S]*clip-path:\s*inset\(50%\);/,
  'Current-run metadata should remain assistive context rather than adding a second visual card above the rail.',
);

assert.match(
  styleSource,
  /@media \(prefers-reduced-motion: reduce\)[\s\S]*\.runs-subnav-recent-link[\s\S]*transition:\s*none;/,
  'The rail motion should respect reduced-motion preferences.',
);
